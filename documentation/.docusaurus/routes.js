import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/monodog/__docusaurus/debug',
    component: ComponentCreator('/monodog/__docusaurus/debug', 'c28'),
    exact: true
  },
  {
    path: '/monodog/__docusaurus/debug/config',
    component: ComponentCreator('/monodog/__docusaurus/debug/config', 'a3d'),
    exact: true
  },
  {
    path: '/monodog/__docusaurus/debug/content',
    component: ComponentCreator('/monodog/__docusaurus/debug/content', '8a9'),
    exact: true
  },
  {
    path: '/monodog/__docusaurus/debug/globalData',
    component: ComponentCreator('/monodog/__docusaurus/debug/globalData', '943'),
    exact: true
  },
  {
    path: '/monodog/__docusaurus/debug/metadata',
    component: ComponentCreator('/monodog/__docusaurus/debug/metadata', '450'),
    exact: true
  },
  {
    path: '/monodog/__docusaurus/debug/registry',
    component: ComponentCreator('/monodog/__docusaurus/debug/registry', 'a53'),
    exact: true
  },
  {
    path: '/monodog/__docusaurus/debug/routes',
    component: ComponentCreator('/monodog/__docusaurus/debug/routes', '48c'),
    exact: true
  },
  {
    path: '/monodog/MonodogLandingPage',
    component: ComponentCreator('/monodog/MonodogLandingPage', 'd86'),
    exact: true
  },
  {
    path: '/monodog/',
    component: ComponentCreator('/monodog/', 'd98'),
    exact: true
  },
  {
    path: '/monodog/',
    component: ComponentCreator('/monodog/', '40f'),
    routes: [
      {
        path: '/monodog/',
        component: ComponentCreator('/monodog/', 'ebd'),
        routes: [
          {
            path: '/monodog/',
            component: ComponentCreator('/monodog/', '744'),
            routes: [
              {
                path: '/monodog/api-reference/commits',
                component: ComponentCreator('/monodog/api-reference/commits', '35f'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/api-reference/config',
                component: ComponentCreator('/monodog/api-reference/config', '37e'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/api-reference/health',
                component: ComponentCreator('/monodog/api-reference/health', '440'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/api-reference/overview',
                component: ComponentCreator('/monodog/api-reference/overview', '706'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/api-reference/packages',
                component: ComponentCreator('/monodog/api-reference/packages', '58b'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/features/dependency-analysis',
                component: ComponentCreator('/monodog/features/dependency-analysis', '764'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/features/git-integration',
                component: ComponentCreator('/monodog/features/git-integration', '84e'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/features/health-monitoring',
                component: ComponentCreator('/monodog/features/health-monitoring', '064'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/features/package-scanning',
                component: ComponentCreator('/monodog/features/package-scanning', 'f4e'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/getting-started/overview',
                component: ComponentCreator('/monodog/getting-started/overview', 'ff8'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/getting-started/prerequisites',
                component: ComponentCreator('/monodog/getting-started/prerequisites', 'd23'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/getting-started/quick-start',
                component: ComponentCreator('/monodog/getting-started/quick-start', 'f88'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/installation/configure-monorepo',
                component: ComponentCreator('/monodog/installation/configure-monorepo', 'bae'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/installation/first-run',
                component: ComponentCreator('/monodog/installation/first-run', 'f2d'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/installation/install-npm',
                component: ComponentCreator('/monodog/installation/install-npm', '65a'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/intro',
                component: ComponentCreator('/monodog/intro', '938'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/upcoming-features/CICD',
                component: ComponentCreator('/monodog/upcoming-features/CICD', '25c'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/monodog/upcoming-features/version-control',
                component: ComponentCreator('/monodog/upcoming-features/version-control', '18b'),
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
