"""add report recipients and confidentiality

Revision ID: e4b8a1c9d2f3
Revises: 02c6d35757d3
Create Date: 2026-09-09 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e4b8a1c9d2f3'
down_revision = '064d3649a4ac'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('reports', schema=None) as batch_op:
        batch_op.add_column(sa.Column('submitted_to_ids', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('submitted_to_names', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('is_confidential', sa.Boolean(), nullable=True, server_default='0'))


def downgrade():
    with op.batch_alter_table('reports', schema=None) as batch_op:
        batch_op.drop_column('is_confidential')
        batch_op.drop_column('submitted_to_names')
        batch_op.drop_column('submitted_to_ids')
