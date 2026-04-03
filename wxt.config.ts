import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  modules: ['@wxt-dev/module-react'],
  browser: 'firefox',
  manifestVersion: 3,
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: [
      'storage',
      'tabs',
      'idle',
      'declarativeNetRequest',
      'activeTab',
    ],
    host_permissions: ['<all_urls>'],
    browser_specific_settings: {
      gecko: {
        id: 'sitesnuker@example.com',
        strict_min_version: '109.0',
      },
    },
    web_accessible_resources: [
      {
        resources: ['/blocked.html'],
        matches: ['<all_urls>'],
      },
    ],
    declarative_net_request: {
      rule_resources: [
        {
          id: 'blocking',
          enabled: true,
          path: 'rules/blocking.json',
        },
      ],
    },
  },
});
