import re
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.session import get_db
from app.models.category import CategoryModel
from app.models.product import ProductModel
from app.models.sale import SaleModel
from app.models.sale_item import SaleItemModel
from app.models.user import UserModel
from app.schemas.common import Paginated
from app.schemas.public import (
    PublicCategoryOut,
    PublicProductOut,
    PublicSaleItemOut,
    PublicSaleOut,
)
from app.services.pdf_service import build_receipt_pdf

router = APIRouter(prefix="/public", tags=["public"])

CATALOG_SORT_MAP = {
    "name": asc(ProductModel.name),
    "-name": desc(ProductModel.name),
    "price_asc": asc(ProductModel.selling_price),
    "price_desc": desc(ProductModel.selling_price),
    "-created_at": desc(ProductModel.created_at),
}


def _extract_clean_phone(raw: str) -> str:
    """Normalize phone string by stripping non-digit characters and standardizing regional prefixes."""
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("92") and len(digits) >= 11:
        digits = "0" + digits[2:]
    return digits


async def _load_product_info(
    db: AsyncSession, product_ids: list[int]
) -> dict[int, tuple[str, str]]:
    if not product_ids:
        return {}
    rows = await db.execute(
        select(ProductModel.id, ProductModel.name, ProductModel.sku_code).where(
            ProductModel.id.in_(product_ids)
        )
    )
    return {row[0]: (row[1], row[2]) for row in rows.all()}


@router.get("/catalog", response_model=Paginated[PublicProductOut])
async def get_public_catalog(
    q: str | None = None,
    category_id: int | None = None,
    in_stock_only: bool = False,
    sort: str = "name",
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> Paginated[PublicProductOut]:
    order_by = CATALOG_SORT_MAP.get(sort, asc(ProductModel.name))
    conditions = [ProductModel.is_archived.is_(False)]

    if q and q.strip():
        term = f"%{q.strip()}%"
        conditions.append(
            or_(ProductModel.name.ilike(term), ProductModel.sku_code.ilike(term))
        )

    if category_id is not None:
        conditions.append(ProductModel.category_id == category_id)

    if in_stock_only:
        conditions.append(ProductModel.current_stock > 0)

    total = await db.scalar(
        select(func.count(ProductModel.id)).where(*conditions)
    ) or 0

    stmt = (
        select(ProductModel)
        .options(selectinload(ProductModel.category))
        .where(*conditions)
        .order_by(order_by)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.scalars(stmt)).all()

    items = [
        PublicProductOut(
            id=p.id,
            sku_code=p.sku_code,
            name=p.name,
            category_id=p.category_id,
            category_name=p.category.name if p.category else None,
            description=p.description,
            image_url=p.image_url,
            selling_price=p.selling_price,
            current_stock=p.current_stock,
            is_in_stock=p.current_stock > 0,
        )
        for p in rows
    ]

    pages = (total + page_size - 1) // page_size if total > 0 else 1
    return Paginated[PublicProductOut](
        items=items, page=page, page_size=page_size, total=total, pages=pages
    )


@router.get("/categories", response_model=list[PublicCategoryOut])
async def get_public_categories(
    db: AsyncSession = Depends(get_db),
) -> list[PublicCategoryOut]:
    stmt = (
        select(
            CategoryModel.id,
            CategoryModel.name,
            CategoryModel.description,
            func.count(ProductModel.id).label("product_count"),
        )
        .outerjoin(
            ProductModel,
            (ProductModel.category_id == CategoryModel.id)
            & (ProductModel.is_archived.is_(False)),
        )
        .group_by(CategoryModel.id, CategoryModel.name, CategoryModel.description)
        .order_by(asc(CategoryModel.name))
    )
    result = await db.execute(stmt)
    return [
        PublicCategoryOut(
            id=row[0],
            name=row[1],
            description=row[2],
            product_count=row[3],
        )
        for row in result.all()
    ]


@router.get("/invoices", response_model=list[PublicSaleOut])
async def lookup_public_invoices(
    phone: str = Query(..., min_length=7, max_length=25),
    db: AsyncSession = Depends(get_db),
) -> list[PublicSaleOut]:
    clean = _extract_clean_phone(phone)
    if len(clean) < 7:
        raise AppError(
            400,
            "INVALID_PHONE",
            "Please provide a valid phone number with at least 7 digits.",
        )

    # Search for sales where customer_name contains the phone number or sub-string
    phone_filter = f"%{clean}%"
    phone_without_zero = clean.lstrip("0")
    if phone_without_zero and len(phone_without_zero) >= 7:
        condition = or_(
            SaleModel.customer_name.ilike(phone_filter),
            SaleModel.customer_name.ilike(f"%{phone_without_zero}%"),
        )
    else:
        condition = SaleModel.customer_name.ilike(phone_filter)

    stmt = (
        select(SaleModel)
        .options(selectinload(SaleModel.items))
        .where(condition)
        .order_by(desc(SaleModel.sale_date))
        .limit(50)
    )
    sales = (await db.scalars(stmt)).all()

    # Preload product details for line items
    all_prod_ids = list(
        {item.product_id for s in sales for item in s.items}
    )
    prod_map = await _load_product_info(db, all_prod_ids)

    out: list[PublicSaleOut] = []
    for s in sales:
        items_out: list[PublicSaleItemOut] = []
        for it in s.items:
            name, sku = prod_map.get(it.product_id, ("-", "-"))
            items_out.append(
                PublicSaleItemOut(
                    id=it.id,
                    product_id=it.product_id,
                    product_name=name,
                    product_sku=sku,
                    quantity=it.quantity,
                    unit_selling_price=it.unit_selling_price,
                    line_revenue=it.line_revenue,
                )
            )
        out.append(
            PublicSaleOut(
                id=s.id,
                transaction_code=s.transaction_code,
                customer_name=s.customer_name,
                total_revenue=s.total_revenue,
                sale_date=s.sale_date,
                items=items_out,
            )
        )
    return out


@router.get("/invoices/{sale_id}/pdf")
async def get_public_invoice_pdf(
    sale_id: int,
    phone: str = Query(..., min_length=7),
    db: AsyncSession = Depends(get_db),
) -> Response:
    clean = _extract_clean_phone(phone)
    phone_without_zero = clean.lstrip("0")

    stmt = (
        select(SaleModel)
        .options(selectinload(SaleModel.items))
        .where(SaleModel.id == sale_id)
    )
    sale = await db.scalar(stmt)
    if sale is None:
        raise AppError(404, "INVOICE_NOT_FOUND", "Invoice not found.")

    cust = sale.customer_name or ""
    cust_digits = re.sub(r"\D", "", cust)

    # Verification: Ensure customer phone matches
    if clean not in cust_digits and (phone_without_zero and phone_without_zero not in cust_digits):
        raise AppError(
            403,
            "UNAUTHORIZED_ACCESS",
            "This invoice does not match the provided phone number.",
        )

    catalog = await _load_product_info(db, [item.product_id for item in sale.items])
    lines = [
        {
            "name": catalog.get(item.product_id, ("-", "-"))[0],
            "sku_code": catalog.get(item.product_id, ("-", "-"))[1],
            "quantity": item.quantity,
            "unit_selling_price": item.unit_selling_price,
            "line_revenue": item.line_revenue,
        }
        for item in sorted(sale.items, key=lambda i: i.id)
    ]

    cashier = None
    if sale.sold_by is not None:
        cashier_row = await db.get(UserModel, sale.sold_by)
        cashier = cashier_row.username if cashier_row else None

    # Crucial: show_profit=False ensures cost & net profit are NEVER exposed on customer receipts!
    pdf_bytes = build_receipt_pdf(
        transaction_code=sale.transaction_code,
        sale_date=sale.sale_date.strftime("%Y-%m-%d %H:%M UTC"),
        customer_name=sale.customer_name or "Walk-in Customer",
        cashier=cashier,
        lines=lines,
        total_revenue=sale.total_revenue,
        total_cost=sale.total_cost,
        total_profit=sale.total_profit,
        show_profit=False,
        payment_method=sale.payment_method or "Cash",
        payment_split=sale.payment_split,
        status=sale.status or "completed",
        refund_amount=sale.refund_amount or Decimal("0.00"),
    )

    safe_customer = (sale.customer_name or "Customer").replace(" ", "_")
    filename = f"Receipt_{safe_customer}_{sale.transaction_code}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
