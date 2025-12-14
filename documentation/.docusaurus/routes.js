import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '5ff'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '5ba'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'a2b'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', 'c3c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', '156'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '88c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '000'),
    exact: true
  },
  {
    path: '/MonodogLandingPage',
    component: ComponentCreator('/MonodogLandingPage', '01e'),
    exact: true
  },
  {
    path: '/',
    component: ComponentCreator('/', '2e1'),
    exact: true
  },
  {
    path: '/',
    component: ComponentCreator('/', '65c'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', '34b'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', '034'),
            routes: [
              {
                path: '/api-reference/commits',
                component: ComponentCreator('/api-reference/commits', '80a'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/api-reference/config',
                component: ComponentCreator('/api-reference/config', '7c6'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/api-reference/health',
                component: ComponentCreator('/api-reference/health', 'a55'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/api-reference/overview',
                component: ComponentCreator('/api-reference/overview', '721'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/api-reference/packages',
                component: ComponentCreator('/api-reference/packages', '9cb'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/features/dependency-analysis',
                component: ComponentCreator('/features/dependency-analysis', 'f29'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/features/git-integration',
                component: ComponentCreator('/features/git-integration', '4bb'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/features/health-monitoring',
                component: ComponentCreator('/features/health-monitoring', 'ecd'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/features/package-scanning',
                component: ComponentCreator('/features/package-scanning', 'bdd'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/getting-started/overview',
                component: ComponentCreator('/getting-started/overview', '204'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/getting-started/prerequisites',
                component: ComponentCreator('/getting-started/prerequisites', '8e8'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/getting-started/quick-start',
                component: ComponentCreator('/getting-started/quick-start', 'fd2'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/installation/configure-monorepo',
                component: ComponentCreator('/installation/configure-monorepo', '7fc'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/installation/first-run',
                component: ComponentCreator('/installation/first-run', 'e0c'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/installation/install-npm',
                component: ComponentCreator('/installation/install-npm', '701'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/intro',
                component: ComponentCreator('/intro', '9fa'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/upcoming-features/CICD',
                component: ComponentCreator('/upcoming-features/CICD', 'c72'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/upcoming-features/version-control',
                component: ComponentCreator('/upcoming-features/version-control', 'c58'),
                exact: true,
                sidebar: "tutorialSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
