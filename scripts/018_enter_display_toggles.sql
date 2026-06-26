alter table if exists profiles add column if not exists enter_show_profile boolean default true;
alter table if exists profiles add column if not exists enter_show_title boolean default true;
alter table if exists profiles add column if not exists enter_show_subtitle boolean default true;

update profiles
set enter_show_profile = coalesce(enter_show_profile, true),
    enter_show_title = coalesce(enter_show_title, true),
    enter_show_subtitle = coalesce(enter_show_subtitle, true)
where true;
