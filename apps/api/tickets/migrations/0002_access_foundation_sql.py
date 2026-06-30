from django.db import migrations

GUEST_AGGREGATE_VIEW_SQL = """
DROP VIEW IF EXISTS guest_aggregates_per_wedding;

CREATE VIEW guest_aggregates_per_wedding AS
SELECT
    invitation_id AS wedding_id,
    CAST(COUNT(*) AS integer) AS total_invited,
    CAST(SUM(CASE WHEN rsvp_status = 'accepted' THEN 1 ELSE 0 END) AS integer)
        AS total_confirmed,
    CAST(SUM(CASE WHEN rsvp_status = 'declined' THEN 1 ELSE 0 END) AS integer)
        AS total_declined
FROM invitations_guest
WHERE archived_at IS NULL
  AND anonymized_at IS NULL
GROUP BY invitation_id;
"""

FORWARD_SQL = """
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.user_role', true), '')
$$;

ALTER TABLE invitations_invitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations_guest ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_ticket ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_select_own_weddings ON invitations_invitation;
DROP POLICY IF EXISTS client_update_own_weddings ON invitations_invitation;
DROP POLICY IF EXISTS client_select_own_orders ON orders_order;
DROP POLICY IF EXISTS client_update_own_orders ON orders_order;
DROP POLICY IF EXISTS staff_select_orders ON orders_order;
DROP POLICY IF EXISTS staff_update_orders ON orders_order;
DROP POLICY IF EXISTS client_select_own_guests ON invitations_guest;
DROP POLICY IF EXISTS client_update_own_guests ON invitations_guest;
DROP POLICY IF EXISTS client_select_own_tickets ON tickets_ticket;
DROP POLICY IF EXISTS client_update_own_tickets ON tickets_ticket;
DROP POLICY IF EXISTS staff_select_tickets ON tickets_ticket;
DROP POLICY IF EXISTS staff_update_tickets ON tickets_ticket;

CREATE POLICY client_select_own_weddings
ON invitations_invitation
FOR SELECT
USING (
    client_user_id = app.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM orders_order order_row
        WHERE order_row.invitation_id = invitations_invitation.id
          AND order_row.client_user_id = app.current_user_id()
    )
);

CREATE POLICY client_update_own_weddings
ON invitations_invitation
FOR UPDATE
USING (
    client_user_id = app.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM orders_order order_row
        WHERE order_row.invitation_id = invitations_invitation.id
          AND order_row.client_user_id = app.current_user_id()
    )
)
WITH CHECK (
    client_user_id = app.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM orders_order order_row
        WHERE order_row.invitation_id = invitations_invitation.id
          AND order_row.client_user_id = app.current_user_id()
    )
);

CREATE POLICY client_select_own_orders
ON orders_order
FOR SELECT
USING (
    client_user_id = app.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM invitations_invitation invitation_row
        WHERE invitation_row.id = orders_order.invitation_id
          AND invitation_row.client_user_id = app.current_user_id()
    )
);

CREATE POLICY client_update_own_orders
ON orders_order
FOR UPDATE
USING (
    client_user_id = app.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM invitations_invitation invitation_row
        WHERE invitation_row.id = orders_order.invitation_id
          AND invitation_row.client_user_id = app.current_user_id()
    )
)
WITH CHECK (
    client_user_id = app.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM invitations_invitation invitation_row
        WHERE invitation_row.id = orders_order.invitation_id
          AND invitation_row.client_user_id = app.current_user_id()
    )
);

CREATE POLICY staff_select_orders
ON orders_order
FOR SELECT
USING (app.current_user_role() = 'staff');

CREATE POLICY staff_update_orders
ON orders_order
FOR UPDATE
USING (app.current_user_role() = 'staff')
WITH CHECK (app.current_user_role() = 'staff');

CREATE POLICY client_select_own_guests
ON invitations_guest
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM invitations_invitation invitation_row
        LEFT JOIN orders_order order_row ON order_row.invitation_id = invitation_row.id
        WHERE invitation_row.id = invitations_guest.invitation_id
          AND (
            invitation_row.client_user_id = app.current_user_id()
            OR order_row.client_user_id = app.current_user_id()
          )
    )
);

CREATE POLICY client_update_own_guests
ON invitations_guest
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM invitations_invitation invitation_row
        LEFT JOIN orders_order order_row ON order_row.invitation_id = invitation_row.id
        WHERE invitation_row.id = invitations_guest.invitation_id
          AND (
            invitation_row.client_user_id = app.current_user_id()
            OR order_row.client_user_id = app.current_user_id()
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM invitations_invitation invitation_row
        LEFT JOIN orders_order order_row ON order_row.invitation_id = invitation_row.id
        WHERE invitation_row.id = invitations_guest.invitation_id
          AND (
            invitation_row.client_user_id = app.current_user_id()
            OR order_row.client_user_id = app.current_user_id()
          )
    )
);

CREATE POLICY client_select_own_tickets
ON tickets_ticket
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM invitations_invitation invitation_row
        LEFT JOIN orders_order order_row ON order_row.invitation_id = invitation_row.id
        WHERE invitation_row.id = tickets_ticket.invitation_id
          AND (
            invitation_row.client_user_id = app.current_user_id()
            OR order_row.client_user_id = app.current_user_id()
          )
    )
);

CREATE POLICY client_update_own_tickets
ON tickets_ticket
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM invitations_invitation invitation_row
        LEFT JOIN orders_order order_row ON order_row.invitation_id = invitation_row.id
        WHERE invitation_row.id = tickets_ticket.invitation_id
          AND (
            invitation_row.client_user_id = app.current_user_id()
            OR order_row.client_user_id = app.current_user_id()
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM invitations_invitation invitation_row
        LEFT JOIN orders_order order_row ON order_row.invitation_id = invitation_row.id
        WHERE invitation_row.id = tickets_ticket.invitation_id
          AND (
            invitation_row.client_user_id = app.current_user_id()
            OR order_row.client_user_id = app.current_user_id()
          )
    )
);

CREATE POLICY staff_select_tickets
ON tickets_ticket
FOR SELECT
USING (app.current_user_role() = 'staff');

CREATE POLICY staff_update_tickets
ON tickets_ticket
FOR UPDATE
USING (app.current_user_role() = 'staff')
WITH CHECK (app.current_user_role() = 'staff');

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'staff') THEN
        GRANT SELECT ON guest_aggregates_per_wedding TO staff;
        GRANT SELECT ON orders_order, tickets_ticket TO staff;
        GRANT UPDATE(status) ON orders_order, tickets_ticket TO staff;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'client') THEN
        GRANT SELECT, UPDATE
        ON invitations_invitation, orders_order, invitations_guest, tickets_ticket
        TO client;
    END IF;
END $$;
"""


REVERSE_SQL = """
DROP VIEW IF EXISTS guest_aggregates_per_wedding;

DROP POLICY IF EXISTS client_select_own_weddings ON invitations_invitation;
DROP POLICY IF EXISTS client_update_own_weddings ON invitations_invitation;
DROP POLICY IF EXISTS client_select_own_orders ON orders_order;
DROP POLICY IF EXISTS client_update_own_orders ON orders_order;
DROP POLICY IF EXISTS staff_select_orders ON orders_order;
DROP POLICY IF EXISTS staff_update_orders ON orders_order;
DROP POLICY IF EXISTS client_select_own_guests ON invitations_guest;
DROP POLICY IF EXISTS client_update_own_guests ON invitations_guest;
DROP POLICY IF EXISTS client_select_own_tickets ON tickets_ticket;
DROP POLICY IF EXISTS client_update_own_tickets ON tickets_ticket;
DROP POLICY IF EXISTS staff_select_tickets ON tickets_ticket;
DROP POLICY IF EXISTS staff_update_tickets ON tickets_ticket;

ALTER TABLE invitations_invitation DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders_order DISABLE ROW LEVEL SECURITY;
ALTER TABLE invitations_guest DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_ticket DISABLE ROW LEVEL SECURITY;
"""


def apply_postgres_access_sql(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        if schema_editor.connection.vendor == "postgresql":
            cursor.execute(FORWARD_SQL.replace("DO $$", f"{GUEST_AGGREGATE_VIEW_SQL}\nDO $$"))
        else:
            for statement in GUEST_AGGREGATE_VIEW_SQL.split(";"):
                if statement.strip():
                    cursor.execute(statement)


def reverse_postgres_access_sql(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        if schema_editor.connection.vendor == "postgresql":
            cursor.execute(REVERSE_SQL)
        else:
            cursor.execute("DROP VIEW IF EXISTS guest_aggregates_per_wedding")


class Migration(migrations.Migration):
    dependencies = [
        ("tickets", "0001_initial"),
        ("users", "0003_binary_user_roles"),
    ]

    operations = [
        migrations.RunPython(apply_postgres_access_sql, reverse_postgres_access_sql),
    ]
