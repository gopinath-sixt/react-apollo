import * as React from 'react';
import { mount } from 'enzyme';
import gql from 'graphql-tag';
import { useMutation } from '../../../src/hooks';
import { MockedProvider } from '../../../src/test-utils';

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

type Data = {
  createTodo: {
    __typename: string;
    id: string;
    text: string;
    completed: boolean;
  };
  __typename: string;
};

const data: Data = {
  createTodo: {
    __typename: 'Todo',
    id: '99',
    text: 'This one was created with a mutation.',
    completed: true,
  },
  __typename: 'Mutation',
};
const data2: Data = {
  createTodo: {
    __typename: 'Todo',
    id: '100',
    text: 'This one was created with a mutation.',
    completed: true,
  },
  __typename: 'Mutation',
};

const mocks = [
  {
    request: { query: mutation },
    result: { data },
  },
  {
    request: { query: mutation },
    result: { data: data2 },
  },
];

it('performs a mutation', done => {
  let count = 0;
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation });
    if (count === 0) {
      expect(result.loading).toEqual(false);
      expect(result.called).toEqual(false);
      setTimeout(() => {
        createTodo();
      });
    } else if (count === 1) {
      expect(result.called).toEqual(true);
      expect(result.loading).toEqual(true);
    } else if (count === 2) {
      expect(result.called).toEqual(true);
      expect(result.loading).toEqual(false);
      expect(result.data).toEqual(data);
      done();
    }
    count++;
    return <div />;
  };

  mount(
    <MockedProvider mocks={mocks}>
      <Component />
    </MockedProvider>,
  );
});
