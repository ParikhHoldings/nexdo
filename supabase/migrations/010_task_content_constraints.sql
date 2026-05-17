-- Enforce the same core task-content bounds at the database layer that the
-- app routes enforce before service-role writes.
--
-- Direct authenticated browser writes are column-limited, but allowed task
-- columns still need database bounds so clients cannot bypass route validation
-- with blank titles, oversized text, impossible estimates, or unbounded arrays.

create or replace function public.text_array_within_bounds(
  value text[],
  max_items integer,
  max_item_length integer
) returns boolean
language sql
immutable
as $$
  select value is null
    or (
      cardinality(value) <= max_items
      and not exists (
        select 1
          from unnest(value) item
         where item is null
            or char_length(btrim(item)) = 0
            or char_length(item) > max_item_length
      )
    );
$$;

alter table tasks
  add constraint tasks_title_length
    check (char_length(btrim(title)) between 1 and 500) not valid,
  add constraint tasks_raw_input_length
    check (raw_input is null or char_length(raw_input) <= 4000) not valid,
  add constraint tasks_description_length
    check (description is null or char_length(description) <= 4000) not valid,
  add constraint tasks_context_length
    check (context is null or char_length(context) <= 4000) not valid,
  add constraint tasks_estimated_minutes_bounds
    check (estimated_minutes is null or estimated_minutes between 0 and 10080) not valid,
  add constraint tasks_people_bounds
    check (public.text_array_within_bounds(people, 50, 120)) not valid,
  add constraint tasks_tags_bounds
    check (public.text_array_within_bounds(tags, 50, 120)) not valid;
