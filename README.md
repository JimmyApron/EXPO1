# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## DeepSeek Edge Function setup

텍스트 기반 AI 기능은 Supabase Edge Functions에서 DeepSeek API를 호출하고, 이미지의 글자 추출과 아이디어 분석만 Claude API를 호출합니다. API 키를 앱의 `.env`나 클라이언트 코드에 넣지 말고 Supabase Dashboard의 Edge Function Secrets에 `DEEPSEEK_API_KEY`와 `ANTHROPIC_API_KEY`로 등록하세요. 모델은 선택 사항인 `DEEPSEEK_MODEL`과 `ANTHROPIC_MODEL` secret으로 지정합니다.

```bash
npx supabase functions deploy
```

`DEEPSEEK_MODEL`에는 `deepseek-v4-flash` 또는 `deepseek-v4-pro`만 사용할 수 있습니다. 값을 생략하면 비용이 낮은 `deepseek-v4-flash`를 사용합니다. 세부 추론 옵션은 전송하지 않으므로 항상 제공자의 Default 설정을 사용합니다. `ANTHROPIC_MODEL`을 생략하면 이미지 요청에 `claude-haiku-4-5-20251001`을 사용합니다. Claude 키와 모델은 이미지 입력 경로에서만 사용됩니다.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
