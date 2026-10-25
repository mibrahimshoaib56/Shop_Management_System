from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class PublicProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku_code: str
    name: str
    category_id: int
    category_name: str | None = None
    description: str | None = None
    image_url: str | None = None
    selling_price: Decimal
    current_stock: int
    is_in_stock: bool


class PublicCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    product_count: int = 0


class PublicSaleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str | None = None
    product_sku: str | None = None
    quantity: int
    unit_selling_price: Decimal
    line_revenue: Decimal


class PublicSaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_code: str
    customer_name: str | None
    total_revenue: Decimal
    sale_date: datetime
    items: list[PublicSaleItemOut] = []
