<table width="100%">
  <tr>
    <td width="190" align="center">
      <img src="assets/alistt69-packages-logo.svg" alt="Logo" width="170" height="170" style="margin-top: 50px;" />
    </td>
    <td>
      <h1>@alistt69/create-api</h1>

> **One helper. No extra.**  
> Light createApi with query, lazy query & mutation hooks.

[![npm version](https://img.shields.io/npm/v/@alistt69/create-api.svg)](https://www.npmjs.com/package/@alistt69/create-api)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
</td>
  </tr>
</table>

## Install
```bash
npm i @alistt69/create-api
```

## Example
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

## Usage
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

## Cache utils
``` typescript
api.util.getQueryData('getPost', '1');
api.util.setQueryData('getPost', '1', { id: '1', title: 'Local title' });
```

## Development
```bash
npm install
npm run typecheck
npm run test
npm run build
npm pack
```