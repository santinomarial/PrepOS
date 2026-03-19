"""add users table and user_id to problems

Revision ID: a3f8d2c1b0e7
Revises: be17c239d523
Create Date: 2026-03-19

NOTE: The user_id column on problems is NOT NULL.  If the database already
contains rows in the problems table this migration will fail.  In that case
drop and recreate the database, then run: alembic upgrade head
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a3f8d2c1b0e7"
down_revision: Union[str, Sequence[str], None] = "be17c239d523"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.add_column(
        "problems",
        sa.Column("user_id", sa.Integer(), nullable=False),
    )
    op.create_foreign_key(
        "fk_problems_user_id",
        "problems",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_problems_user_id", "problems", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_problems_user_id", table_name="problems")
    op.drop_constraint("fk_problems_user_id", "problems", type_="foreignkey")
    op.drop_column("problems", "user_id")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
