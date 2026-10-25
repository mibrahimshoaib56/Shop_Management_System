from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ─── Customer ────────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    phone: str | None = Field(None, max_length=30)
    address: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    phone: str | None = Field(None, max_length=30)
    address: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str | None
    address: str | None
    notes: str | None
    is_active: bool
    outstanding_balance: Decimal
    created_at: datetime


# ─── Khata / Ledger Entry ─────────────────────────────────────────────────────

class KhataEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    entry_type: str          # 'credit' | 'payment'
    amount: Decimal
    sale_id: int | None
    notes: str | None
    recorded_by: int | None
    created_at: datetime


class RecordPaymentRequest(BaseModel):
    """Customer manually pays back some/all of their Udhaar balance."""
    amount: Decimal = Field(..., gt=0)
    notes: str | None = None


class KhataCustomerLedger(BaseModel):
    """Full ledger for one customer."""
    model_config = ConfigDict(from_attributes=True)

    customer: CustomerOut
    entries: list[KhataEntryOut]
    total_credit: Decimal   # sum of all 'credit' entries
    total_paid: Decimal     # sum of all 'payment' entries
    outstanding: Decimal    # current balance
