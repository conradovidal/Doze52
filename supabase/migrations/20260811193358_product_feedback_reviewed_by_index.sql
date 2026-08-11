create index product_feedback_submissions_reviewed_by_idx
  on public.product_feedback_submissions(reviewed_by)
  where reviewed_by is not null;
