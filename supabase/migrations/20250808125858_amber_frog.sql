/*
  # Исправление поля password_hash в таблице users

  1. Изменения
    - Делаем поле `password_hash` в таблице `users` допускающим NULL значения
    - Это необходимо, поскольку аутентификация полностью обрабатывается Supabase Auth
    - Поле `password_hash` больше не используется в логике приложения

  2. Причина изменения
    - Скрипт создания тестовых пользователей падает с ошибкой NOT NULL constraint
    - Согласно документации, поле password_hash было удалено из логики приложения
    - Аутентификация теперь полностью на Supabase Auth
*/

-- Делаем поле password_hash допускающим NULL значения
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- Обновляем существующие записи, если они есть, устанавливая NULL для password_hash
UPDATE public.users SET password_hash = NULL WHERE password_hash IS NOT NULL;