"""split payments and refunds

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-25
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales",
        sa.Column(
            "payment_method",
            sa.String(50),
            nullable=False,
            server_default=sa.text("'Cash'"),
        ),
    )
    op.add_column(
        "sales",
        sa.Column("payment_split", sa.String(500), nullable=True),
    )
    op.add_column(
        "sales",
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
            server_default=sa.text("'completed'"),
        ),
    )
    op.add_column(
        "sales",
        sa.Column(
            "refund_amount",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0.00"),
        ),
    )
    op.add_column(
        "sales",
        sa.Column("refund_reason", sa.String(255), nullable=True),
    )
    op.add_column(
        "sales",
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "sale_items",
        sa.Column(
            "returned_quantity",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("sale_items", "returned_quantity")
    op.drop_column("sales", "refunded_at")
    op.drop_column("sales", "refund_reason")
    op.drop_column("sales", "refund_amount")
    op.drop_column("sales", "status")
    op.drop_column("sales", "payment_split")
    op.drop_column("sales", "payment_method")
