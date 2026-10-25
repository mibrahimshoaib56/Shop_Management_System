from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CheckoutItem(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class CheckoutRequest(BaseModel):
    customer_name: str | None = Field(default=None, max_length=150)
    customer_id: int | None = Field(default=None)  # required when payment_method='Khata'
    items: list[CheckoutItem] = Field(min_length=1)
    payment_method: str = Field(default="Cash", max_length=50)
    payment_split: str | None = Field(default=None, max_length=500)
    discount_amount: Decimal = Field(default=Decimal("0.00"), ge=0)

    @model_validator(mode="after")
    def validate_khata(self) -> "CheckoutRequest":
        ids = [item.product_id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate product_id entries in cart.")
        if self.payment_method == "Khata" and not self.customer_id:
            raise ValueError("customer_id is required when payment_method is 'Khata'.")
        return self


class RefundItemRequest(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class RefundRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=255)
    items: list[RefundItemRequest] | None = None


class SaleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    unit_buying_price: Decimal
    unit_selling_price: Decimal
    line_revenue: Decimal
    line_profit: Decimal
    returned_quantity: int = 0
    product_name: str | None = None
    product_sku: str | None = None


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_code: str
    customer_name: str | None
    customer_id: int | None = None
    total_revenue: Decimal
    total_cost: Decimal
    total_profit: Decimal
    sale_date: datetime
    payment_method: str = "Cash"
    payment_split: str | None = None
    status: str = "completed"
    refund_amount: Decimal = Decimal("0.00")
    refund_reason: str | None = None
    refunded_at: datetime | None = None
    discount_amount: Decimal = Decimal("0.00")


class SaleDetailOut(SaleOut):
    items: list[SaleItemOut] = []


class CheckoutResponse(SaleDetailOut):
    pass
