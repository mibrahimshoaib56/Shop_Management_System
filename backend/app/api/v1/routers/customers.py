"""
Customer & Khata (Udhaar Ledger) Router
========================================
GET    /customers                   → list all customers (with optional search)
POST   /customers                   → create a new customer
GET    /customers/{id}              → single customer details
PUT    /customers/{id}              → update customer
DELETE /customers/{id}              → soft-delete (set is_active=False)

GET    /customers/{id}/ledger       → full ledger (all entries) for a customer
POST   /customers/{id}/payment      → record a manual cash-back payment
GET    /customers/summary           → totals: total customers, total outstanding
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.customer import CustomerModel
from app.models.khata_entry import KhataEntryModel
from app.models.user import UserModel
from app.schemas.customers import (
    CustomerCreate,
    CustomerOut,
    CustomerUpdate,
    KhataCustomerLedger,
    KhataEntryOut,
    RecordPaymentRequest,
)

router = APIRouter(prefix="/customers", tags=["Customers & Khata"])


# ─── helpers ─────────────────────────────────────────────────────────────────

async def _get_customer_or_404(
    customer_id: int, session: AsyncSession
) -> CustomerModel:
    result = await session.execute(
        select(CustomerModel).where(CustomerModel.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


# ─── Summary ─────────────────────────────────────────────────────────────────

@router.get("/summary")
async def get_khata_summary(
    session: AsyncSession = Depends(get_db),
    _: UserModel = Depends(get_current_user),
):
    """Aggregate stats for the Khata dashboard widget."""
    result = await session.execute(
        select(
            func.count(CustomerModel.id).label("total_customers"),
            func.sum(CustomerModel.outstanding_balance).label("total_outstanding"),
        ).where(CustomerModel.is_active == True)
    )
    row = result.one()
    return {
        "total_customers": row.total_customers or 0,
        "total_outstanding": float(row.total_outstanding or 0),
    }


# ─── List / Create ───────────────────────────────────────────────────────────

@router.get("", response_model=list[CustomerOut])
async def list_customers(
    search: str | None = Query(None),
    active_only: bool = Query(True),
    session: AsyncSession = Depends(get_db),
    _: UserModel = Depends(get_current_user),
):
    q = select(CustomerModel)
    if active_only:
        q = q.where(CustomerModel.is_active == True)
    if search:
        q = q.where(CustomerModel.name.ilike(f"%{search}%"))
    q = q.order_by(CustomerModel.outstanding_balance.desc(), CustomerModel.name)
    result = await session.execute(q)
    return result.scalars().all()


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    body: CustomerCreate,
    session: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    customer = CustomerModel(**body.model_dump())
    session.add(customer)
    await session.commit()
    await session.refresh(customer)
    return customer


# ─── Single Customer ─────────────────────────────────────────────────────────

@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: int,
    session: AsyncSession = Depends(get_db),
    _: UserModel = Depends(get_current_user),
):
    return await _get_customer_or_404(customer_id, session)


@router.put("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    session: AsyncSession = Depends(get_db),
    _: UserModel = Depends(get_current_user),
):
    customer = await _get_customer_or_404(customer_id, session)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(customer, k, v)
    await session.commit()
    await session.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: int,
    session: AsyncSession = Depends(get_db),
    _: UserModel = Depends(require_admin),
):
    customer = await _get_customer_or_404(customer_id, session)
    customer.is_active = False
    await session.commit()


# ─── Ledger ──────────────────────────────────────────────────────────────────

@router.get("/{customer_id}/ledger", response_model=KhataCustomerLedger)
async def get_customer_ledger(
    customer_id: int,
    session: AsyncSession = Depends(get_db),
    _: UserModel = Depends(get_current_user),
):
    customer = await _get_customer_or_404(customer_id, session)

    entries_result = await session.execute(
        select(KhataEntryModel)
        .where(KhataEntryModel.customer_id == customer_id)
        .order_by(KhataEntryModel.created_at.asc())
    )
    entries = entries_result.scalars().all()

    total_credit = sum(e.amount for e in entries if e.entry_type == "credit")
    total_paid = sum(e.amount for e in entries if e.entry_type == "payment")

    return {
        "customer": customer,
        "entries": entries,
        "total_credit": total_credit,
        "total_paid": total_paid,
        "outstanding": customer.outstanding_balance,
    }


@router.post("/{customer_id}/payment", response_model=KhataEntryOut)
async def record_payment(
    customer_id: int,
    body: RecordPaymentRequest,
    session: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Record a cash payment from the customer that reduces their balance."""
    customer = await _get_customer_or_404(customer_id, session)

    if body.amount > customer.outstanding_balance:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Payment Rs. {body.amount} exceeds outstanding balance "
                f"Rs. {customer.outstanding_balance}. "
                "Use the exact amount or less."
            ),
        )

    entry = KhataEntryModel(
        customer_id=customer_id,
        entry_type="payment",
        amount=body.amount,
        notes=body.notes,
        recorded_by=current_user.id,
    )
    session.add(entry)
    customer.outstanding_balance = customer.outstanding_balance - body.amount
    await session.commit()
    await session.refresh(entry)
    return entry
