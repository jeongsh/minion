-- Deletion hides only the participant's mailbox entry. Participant SELECT access
-- must remain valid after UPDATE, otherwise PostgreSQL rejects the soft delete.
-- Mailbox queries explicitly filter the owner's deleted_at column.
alter policy "participants read own messages" on public.direct_messages
using ((select auth.uid()) in (sender_id, recipient_id));
