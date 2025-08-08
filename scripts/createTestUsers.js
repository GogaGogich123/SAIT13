import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Загружаем переменные окружения
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Отсутствуют необходимые переменные окружения:');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

// Создаем клиент Supabase с service_role ключом
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Тестовые пользователи
const testUsers = [
  // Администратор
  {
    email: 'admin@nkkk.ru',
    password: 'admin123',
    role: 'admin',
    name: 'Администратор НККК',
    userData: {
      name: 'Администратор НККК',
      role: 'admin'
    }
  },
  // Кадеты
  {
    email: 'petrov.alexey@nkkk.ru',
    password: 'cadet123',
    role: 'cadet',
    name: 'Петров Алексей Владимирович',
    userData: {
      name: 'Петров Алексей Владимирович',
      role: 'cadet'
    },
    cadetData: {
      name: 'Петров Алексей Владимирович',
      email: 'petrov.alexey@nkkk.ru',
      platoon: '10-1',
      squad: 1,
      rank: 1,
      total_score: 275,
      avatar_url: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?w=200',
      join_date: '2023-09-01'
    }
  },
  {
    email: 'sidorov.dmitry@nkkk.ru',
    password: 'cadet123',
    role: 'cadet',
    name: 'Сидоров Дмитрий Александрович',
    userData: {
      name: 'Сидоров Дмитрий Александрович',
      role: 'cadet'
    },
    cadetData: {
      name: 'Сидоров Дмитрий Александрович',
      email: 'sidorov.dmitry@nkkk.ru',
      platoon: '10-1',
      squad: 1,
      rank: 2,
      total_score: 268,
      avatar_url: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?w=200',
      join_date: '2023-09-01'
    }
  },
  {
    email: 'kozlov.mikhail@nkkk.ru',
    password: 'cadet123',
    role: 'cadet',
    name: 'Козлов Михаил Сергеевич',
    userData: {
      name: 'Козлов Михаил Сергеевич',
      role: 'cadet'
    },
    cadetData: {
      name: 'Козлов Михаил Сергеевич',
      email: 'kozlov.mikhail@nkkk.ru',
      platoon: '10-2',
      squad: 2,
      rank: 3,
      total_score: 255,
      avatar_url: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?w=200',
      join_date: '2023-09-01'
    }
  },
  {
    email: 'volkov.andrey@nkkk.ru',
    password: 'cadet123',
    role: 'cadet',
    name: 'Волков Андрей Николаевич',
    userData: {
      name: 'Волков Андрей Николаевич',
      role: 'cadet'
    },
    cadetData: {
      name: 'Волков Андрей Николаевич',
      email: 'volkov.andrey@nkkk.ru',
      platoon: '9-1',
      squad: 1,
      rank: 4,
      total_score: 242,
      avatar_url: 'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?w=200',
      join_date: '2023-09-01'
    }
  },
  {
    email: 'morozov.vladislav@nkkk.ru',
    password: 'cadet123',
    role: 'cadet',
    name: 'Морозов Владислав Игоревич',
    userData: {
      name: 'Морозов Владислав Игоревич',
      role: 'cadet'
    },
    cadetData: {
      name: 'Морозов Владислав Игоревич',
      email: 'morozov.vladislav@nkkk.ru',
      platoon: '9-2',
      squad: 2,
      rank: 5,
      total_score: 238,
      avatar_url: 'https://images.pexels.com/photos/1043473/pexels-photo-1043473.jpeg?w=200',
      join_date: '2023-09-01'
    }
  }
];

async function createTestUsers() {
  console.log('🚀 Начинаем создание тестовых пользователей...\n');

  for (const user of testUsers) {
    try {
      console.log(`📝 Создаем пользователя: ${user.name} (${user.email})`);

      // 1. Создаем пользователя в Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role
        }
      });

      if (authError) {
        console.error(`❌ Ошибка создания пользователя ${user.email}:`, authError.message);
        continue;
      }

      console.log(`✅ Пользователь создан в Auth с ID: ${authData.user.id}`);

      // 2. Создаем запись в таблице users
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: authData.user.id,
          email: user.email,
          name: user.userData.name,
          role: user.userData.role
        }]);

      if (userError) {
        console.error(`❌ Ошибка создания записи в таблице users:`, userError.message);
        continue;
      }

      console.log(`✅ Запись создана в таблице users`);

      // 3. Если это кадет, создаем запись в таблице cadets
      if (user.role === 'cadet' && user.cadetData) {
        const { error: cadetError } = await supabase
          .from('cadets')
          .insert([{
            ...user.cadetData,
            auth_user_id: authData.user.id
          }]);

        if (cadetError) {
          console.error(`❌ Ошибка создания записи в таблице cadets:`, cadetError.message);
          continue;
        }

        console.log(`✅ Запись создана в таблице cadets`);

        // 4. Создаем начальные баллы для кадета
        const { error: scoresError } = await supabase
          .from('scores')
          .insert([{
            cadet_id: (await supabase
              .from('cadets')
              .select('id')
              .eq('auth_user_id', authData.user.id)
              .single()).data.id,
            study_score: Math.floor(user.cadetData.total_score * 0.35),
            discipline_score: Math.floor(user.cadetData.total_score * 0.32),
            events_score: Math.floor(user.cadetData.total_score * 0.33)
          }]);

        if (scoresError) {
          console.error(`❌ Ошибка создания баллов для кадета:`, scoresError.message);
        } else {
          console.log(`✅ Начальные баллы созданы для кадета`);
        }
      }

      console.log(`🎉 Пользователь ${user.name} успешно создан!\n`);

    } catch (error) {
      console.error(`❌ Неожиданная ошибка при создании пользователя ${user.email}:`, error);
    }
  }

  console.log('✨ Создание тестовых пользователей завершено!');
  console.log('\n📋 Учетные данные для входа:');
  console.log('👨‍💼 Администратор: admin@nkkk.ru / admin123');
  console.log('🎓 Кадеты: [имя].@nkkk.ru / cadet123');
  console.log('\n🔗 Проверьте пользователей в Supabase Dashboard:');
  console.log(`${supabaseUrl.replace('/rest/v1', '')}/project/default/auth/users`);
}

// Запускаем создание пользователей
createTestUsers().catch(console.error);