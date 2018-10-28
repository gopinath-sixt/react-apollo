# Apollo Hooks

## Mutation hook

Use as follows:

`const [result, action] = useMutation({ mutation });`

You can add additional options as per the original `Mutation` component.
Name the destructured `result` and `action` as you like, similar to using the buil-in `useState` hook.

The `result` contains the following (just like for the `Mutation` component):

- `called`
- `loading`
- `data`
- `error`
- `client`

### useMutation Example

```ts
const mutation = gql`
  mutation createTodo($text: String!) {
    createTodo {
      id
      text
      completed
      __typename
    }
    __typename
  }
`;

const CreateTodoButton = (props: any) => {
  const [_, createTodo] = useMutation({ mutation });
  const todo = new Todo(props);
  return <button name="create" onClick={() => createTodo(todo)} />;
};
```

## Query hook

Use as follows:

`const result = useQuery({ query: todosQuery })`

You can add additional options as per the original `Query` component.
Name the destructured `result` as you like.

The `result` contains the following (just like the `Query` component):

- `loading`
- `data`
- `error`
- `client`

### useQuery Example

```ts
const DisplayTodo = (props: any) => {
  const todosResult = useQuery({ query: todosQuery });
  return todosResult.data.map((todo, i) => {
    <Todo ...todo/>
  })
}
```

## Provider hook

Use as follows:

`const context = useProvider({ client: props.client });`

You can add additional options as per the original `ApolloProvider` component.

```ts
const Container = (props: Props) => {
  const context = useProvider({ client: props.client });
  return <Child ...context />;
};
```

## Notes

The hooks API is under development and still very experimental. Please help improve it by contributing your ideas, design and implementation to make using
Apollo with React Hooks an amazing experience going forward.

Please also help improve the test suite to be as good or better as the original suite for the `Query` and `Mutation` components.
