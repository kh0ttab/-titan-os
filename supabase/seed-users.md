# Seed Demo Users

After running `schema.sql`, create these demo users in Supabase Dashboard → Authentication → Users → Add User:

| Email                     | Password  | Name           | Role              | Dept        |
|---------------------------|-----------|----------------|-------------------|-------------|
| admin@titan.demo          | titan123! | Marcus Reid    | CEO               | Executive   |
| jordan@titan.demo         | titan123! | Jordan Blake   | Head of Sales     | Sales       |
| priya@titan.demo          | titan123! | Priya Sharma   | HR Director       | HR          |
| derek@titan.demo          | titan123! | Derek Cole     | VP Engineering    | Engineering |
| sofia@titan.demo          | titan123! | Sofia Torres   | Head of Marketing | Marketing   |

**Or** run this in the SQL Editor after creating users via Auth UI:

```sql
-- Update profiles with correct metadata (run after users are created via Auth UI)
-- Replace the UUIDs below with the actual UUIDs from your auth.users table

-- To find UUIDs: SELECT id, email FROM auth.users;

-- Then update each profile:
-- UPDATE public.profiles SET name='Marcus Reid', role='CEO', initials='MR', color='#00d4ff', dept='Executive', is_admin=true WHERE id = '<UUID>';
-- UPDATE public.profiles SET name='Jordan Blake', role='Head of Sales', initials='JB', color='#00e87a', dept='Sales', is_admin=false WHERE id = '<UUID>';
-- UPDATE public.profiles SET name='Priya Sharma', role='HR Director', initials='PS', color='#a855f7', dept='HR', is_admin=false WHERE id = '<UUID>';
-- UPDATE public.profiles SET name='Derek Cole', role='VP Engineering', initials='DC', color='#ffb300', dept='Engineering', is_admin=true WHERE id = '<UUID>';
-- UPDATE public.profiles SET name='Sofia Torres', role='Head of Marketing', initials='ST', color='#ec4899', dept='Marketing', is_admin=false WHERE id = '<UUID>';
```

**Tip:** If you enable "Confirm email" in Auth settings, disable it for demo accounts or users won't be able to log in immediately. Go to Authentication → Providers → Email and turn off "Confirm email".
