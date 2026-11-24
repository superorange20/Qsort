-- Run once in Supabase SQL Editor to allow exam sets 1-20.
-- Existing user progress and history are preserved.
alter table public.exam_states
  drop constraint if exists exam_states_paper_id_check;
alter table public.exam_states
  add constraint exam_states_paper_id_check check (paper_id between 1 and 20);

alter table public.exam_history
  drop constraint if exists exam_history_paper_id_check;
alter table public.exam_history
  add constraint exam_history_paper_id_check check (paper_id between 1 and 20);
