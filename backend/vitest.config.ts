import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
  sequence: { concurrent: false },
  // 並列実行による afterEach(purge) が他テスト進行中 DB をクリアしてしまい
  // 401 (User not found) や sweep 結果 0 のレースが発生していたため
  // グローバル同時実行数を 1 に制限しテストを逐次化
  maxConcurrency: 1,
    poolOptions: {
      threads: { singleThread: true }
    },
    coverage: {
      enabled: false
    }
  }
});
