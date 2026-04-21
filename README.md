<table width="100%">
  <tr>
    <td width="190" align="center">
      <img src="assets/alistt69-packages-logo.svg" alt="Logo" width="170" height="170" style="margin-top: 50px;" />
    </td>
    <td>
      <h1>@alistt69/create-api</h1>

> **One helper. No extra.**  
> A lightweight createApi inspired by **RTKQ** — with query, lazy query and mutation hooks, built-in cache utilities, stale data handling and a tiny, focused API.

[![npm version](https://img.shields.io/npm/v/@alistt69/create-api.svg)](https://www.npmjs.com/package/@alistt69/create-api)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/react-%3E%3D16.8-149eca?logo=react&logoColor=white)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/alistt69/alistt69-create-api/actions/workflows/ci.yml/badge.svg)](https://github.com/alistt69/alistt69-create-api/actions/workflows/ci.yml)
</td>
  </tr>
</table>

## ✨ Overview

`@alistt69/create-api` is a lightweight [RTK Query-inspired](https://redux-toolkit.js.org/rtk-query/overview) helper for React apps that need a clean createApi experience without Redux.

It provides query, lazy query and mutation hooks, cache helpers and stale data support in a compact API designed for everyday app needs.

## 🔧  What’s inside

| Feature              | Purpose                              |
| -------------------- | ------------------------------------ |
| Query hooks          | Fetch data with generated hooks      |
| Lazy query hooks     | Trigger queries manually when needed |
| Mutation hooks       | Handle writes with generated hooks   |
| Cache utils          | Read and patch cached data manually  |
| Stale time support   | Reuse cached data before refetching  |
| Keep unused data for | Control cache lifetime after unmount |

## 🎯 Why use it?

This package is specified for projects with no Redux. 

It gives you a RTKQ-similar API model and developer experience, while staying smaller, simpler and focused on the most common data-fetching needs.

Do whatever you want and however you want with:
* generated hooks
* predictable cache behavior
* simple manual cache updates
* a focused API without a larger state layer

## 📦 Requirements
* Node.js 18 or higher
* React 16.8 or higher

## 🔥 Install
```bash
npm i @alistt69/create-api
```

## ⚡ Quick example
```typescript jsx
import { createApi } from '@alistt69/create-api';

const api = createApi({
    baseQuery: async ({ url, method = 'GET', body, signal }) => {
        const res = await fetch(url, {
            method,
            signal,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!res.ok) {
            throw await res.json();
        }

        return res.json();
    },

    endpoints: (builder) => ({
        getPost: builder.query({
            query: (id) => ({ url: `/api/posts/${id}` }),
        }),

        updatePost: builder.mutation({
            query: ({ id, title }) => ({
                url: `/api/posts/${id}`,
                method: 'PATCH',
                body: { title },
            }),
        }),
    }),
});
```

## 🛠️ Usage
```typescript jsx
function Post() {
  const { data, isLoading } = api.useGetPostQuery('1');
  const [updatePost] = api.useUpdatePostMutation();

  if (isLoading) return <div>Loading...</div>;

  return (
    <button onClick={() => updatePost({ id: '1', title: 'Updated' })}>
      {data?.title}
    </button>
  );
}
```

## ⚙️ Cache utils
``` typescript
api.util.getQueryData('getPost', '1');
api.util.setQueryData('getPost', '1', { id: '1', title: 'Local title' });
```

## 📄 License

MIT — free and open for everyone.

_See [LICENSE](./LICENSE)._