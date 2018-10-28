import * as React from 'react';
import { mount } from 'enzyme';
import gql from 'graphql-tag';
import { ApolloClient, ApolloError } from 'apollo-client';
import { InMemoryCache as Cache } from 'apollo-cache-inmemory';
import { DataProxy } from 'apollo-cache';
import { ExecutionResult, GraphQLError } from 'graphql';

import { useMutation, useQuery, useProvider } from '../../../src/hooks';
import { MockedProvider, MockLink, mockSingleLink } from '../../../src/test-utils';

import stripSymbols from '../../test-utils/stripSymbols';

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

const cache = new Cache({ addTypename: false });

it('pick prop client over context client', async done => {
  const mock = (text: string) => [
    {
      request: { query: mutation },
      result: {
        data: {
          createTodo: {
            __typename: 'Todo',
            id: '99',
            text,
            completed: true,
          },
          __typename: 'Mutation',
        },
      },
    },
    {
      request: { query: mutation },
      result: {
        data: {
          createTodo: {
            __typename: 'Todo',
            id: '100',
            text,
            completed: true,
          },
          __typename: 'Mutation',
        },
      },
    },
  ];

  const mocksProps = mock('This is the result of the prop client mutation.');
  const mocksContext = mock('This is the result of the context client mutation.');

  function mockClient(m: any) {
    return new ApolloClient({
      link: new MockLink(m, false),
      cache: new Cache({ addTypename: false }),
    });
  }

  const contextClient = mockClient(mocksContext);
  const propsClient = mockClient(mocksProps);
  const spy = jest.fn();

  const Component = (props: any) => {
    const context = useProvider({ client: contextClient, ...props });
    const [_, createTodo] = useMutation({ client: propsClient, mutation });
    return <button onClick={() => createTodo().then(spy)} />;
  };

  const wrapper = mount(<Component />);
  const button = wrapper.find('button').first();

  // context client mutation
  button.simulate('click');

  // props client mutation
  wrapper.setProps({ propsClient });
  button.simulate('click');

  // context client mutation
  wrapper.setProps({ propsClient: undefined });
  button.simulate('click');

  // props client mutation
  wrapper.setProps({ propsClient });
  button.simulate('click');

  setTimeout(() => {
    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy).toHaveBeenCalledWith(mocksContext[0].result);
    expect(spy).toHaveBeenCalledWith(mocksProps[0].result);
    expect(spy).toHaveBeenCalledWith(mocksContext[1].result);
    expect(spy).toHaveBeenCalledWith(mocksProps[1].result);

    done();
  }, 10);
});

it('can bind only the mutation and not rerender by props', done => {
  let count = 0;
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation, ignoreResults: true });

    if (count === 0) {
      expect(result.loading).toEqual(false);
      expect(result.called).toEqual(false);
      setTimeout(() => {
        createTodo().then((r: any) => {
          expect(r!.data).toEqual(data);
          done();
        });
      });
    } else if (count === 1) {
      done.fail('rerender happened with ignoreResults turned on');
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

it('returns a resolved promise when calling the mutation function', done => {
  let called = false;
  const Component = () => {
    const [_, createTodo] = useMutation({ mutation });
    if (!called) {
      setTimeout(() => {
        createTodo().then((result: any) => {
          expect(result!.data).toEqual(data);
          done();
        });
      });
    }
    called = true;
    return null;
  };

  mount(
    <MockedProvider mocks={mocks}>
      <Component />
    </MockedProvider>,
  );
});

it('returns rejected promise when calling the mutation function', done => {
  let called = false;
  const Component = () => {
    const [_, createTodo] = useMutation({ mutation }, mutation);
    if (!called) {
      setTimeout(() => {
        createTodo().catch(error => {
          expect(error).toEqual(new Error('Network error: Error 1'));
          done();
        });
      });
    }

    called = true;

    return null;
  };
  const mocksWithErrors = [
    {
      request: { query: mutation },
      error: new Error('Error 1'),
    },
  ];

  mount(
    <MockedProvider mocks={mocksWithErrors}>
      <Component />
    </MockedProvider>,
  );
});

it('only shows result for the latest mutation that is in flight', done => {
  let count = 0;

  const onCompleted = (dataMutation: Data) => {
    if (count === 1) {
      expect(dataMutation).toEqual(data);
    } else if (count === 3) {
      expect(dataMutation).toEqual(data2);
      done();
    }
  };
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation, onCompleted });
    if (count === 0) {
      expect(result.called).toEqual(false);
      expect(result.loading).toEqual(false);

      setTimeout(() => {
        createTodo();
        createTodo();
      });
    } else if (count === 1) {
      expect(result.called).toEqual(true);
      expect(result.loading).toEqual(true);
    } else if (count === 2) {
      expect(result.loading).toEqual(false);
      expect(result.called).toEqual(true);
      expect(result.data).toEqual(data2);
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

it('only shows the error for the latest mutation in flight', done => {
  let count = 0;

  const onError = (error: Error) => {
    if (count === 1) {
      expect(error).toEqual(new Error('Network error: Error 1'));
    } else if (count === 3) {
      expect(error).toEqual(new Error('Network error: Error 2'));
      done();
    }
  };
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation, onError });
    if (count === 0) {
      expect(result.called).toEqual(false);
      expect(result.loading).toEqual(false);
      setTimeout(() => {
        createTodo();
        createTodo();
      });
    } else if (count === 1) {
      expect(result.loading).toEqual(true);
      expect(result.called).toEqual(true);
    } else if (count === 2) {
      expect(result.loading).toEqual(false);
      expect(result.data).toEqual(undefined);
      expect(result.called).toEqual(true);
      expect(result.error).toEqual(new Error('Network error: Error 2'));
    }
    count++;
    return <div />;
  };
  const mocksWithErrors = [
    {
      request: { query: mutation },
      error: new Error('Error 2'),
    },
    {
      request: { query: mutation },
      error: new Error('Error 2'),
    },
  ];

  mount(
    <MockedProvider mocks={mocksWithErrors}>
      <Component />
    </MockedProvider>,
  );
});

it('calls the onCompleted prop as soon as the mutation is complete', done => {
  let onCompletedCalled = false;

  class Component extends React.Component {
    state = {
      mutationDone: false,
    };

    onCompleted = (mutationData: Data) => {
      expect(mutationData).toEqual(data);
      onCompletedCalled = true;
      this.setState({
        mutationDone: true,
      });
    };

    render() {
      const [result, createTodo] = useMutation({ mutation, onCompleted: this.onCompleted });
      if (!result.called) {
        expect(this.state.mutationDone).toBe(false);
        setTimeout(() => {
          createTodo();
        });
      }
      if (onCompletedCalled) {
        expect(this.state.mutationDone).toBe(true);
        done();
      }
      return null;
    }
  }

  mount(
    <MockedProvider mocks={mocks}>
      <Component />
    </MockedProvider>,
  );
});

it('renders result of the children render prop', () => {
  const Component = () => {
    useMutation({ mutation });
    return <div />;
  };

  const wrapper = mount(
    <MockedProvider mocks={mocks}>
      <Component />
    </MockedProvider>,
  );
  expect(wrapper.find('div').exists()).toBe(true);
});

it('renders an error state', done => {
  let count = 0;
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation });
    if (count === 0) {
      setTimeout(() =>
        createTodo().catch(err => {
          expect(err).toEqual(new Error('Network error: error occurred'));
        }),
      );
    } else if (count === 1) {
      expect(result.loading).toBeTruthy();
    } else if (count === 2) {
      expect(result.error).toEqual(new Error('Network error: error occurred'));
      done();
    }
    count++;
    return <div />;
  };
  const mockError = [
    {
      request: { query: mutation },
      error: new Error('error occurred'),
    },
  ];

  mount(
    <MockedProvider mocks={mockError}>
      <Component />
    </MockedProvider>,
  );
});

it('renders an error state and throws when encountering graphql errors', done => {
  let count = 0;

  const expectedError = new ApolloError({ graphQLErrors: [new GraphQLError('error occurred')] });

  const Component = () => {
    const [result, createTodo] = useMutation({ mutation });
    if (count === 0) {
      setTimeout(() =>
        createTodo()
          .then(() => {
            done.fail('Did not expect a result');
          })
          .catch(e => {
            expect(e).toEqual(expectedError);
          }),
      );
    } else if (count === 1) {
      expect(result.loading).toBeTruthy();
    } else if (count === 2) {
      expect(result.error).toEqual(expectedError);
      done();
    }
    count++;
    return <div />;
  };

  const mockError = [
    {
      request: { query: mutation },
      result: {
        errors: [new GraphQLError('error occurred')],
      },
    },
  ];

  mount(
    <MockedProvider mocks={mockError}>
      <Component />
    </MockedProvider>,
  );
});

it('renders an error state and does not throw when encountering graphql errors when errorPolicy=all', done => {
  let count = 0;
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation });
    if (count === 0) {
      setTimeout(() =>
        createTodo()
          .then(fetchResult => {
            if (fetchResult && fetchResult.errors) {
              expect(fetchResult.errors.length).toEqual(1);
              expect(fetchResult.errors[0]).toEqual(new GraphQLError('error occurred'));
            } else {
              done.fail(`Expected an object with array of errors but got ${fetchResult}`);
            }
          })
          .catch(e => {
            done.fail(e);
          }),
      );
    } else if (count === 1) {
      expect(result.loading).toBeTruthy();
    } else if (count === 2) {
      expect(result.error).toEqual(
        new ApolloError({ graphQLErrors: [new GraphQLError('error occurred')] }),
      );
      done();
    }
    count++;
    return <div />;
  };

  const mockError = [
    {
      request: { query: mutation },
      result: {
        errors: [new GraphQLError('error occurred')],
      },
    },
  ];

  mount(
    <MockedProvider defaultOptions={{ mutate: { errorPolicy: 'all' } }} mocks={mockError}>
      <Component />
    </MockedProvider>,
  );
});

it('renders an error state and throws when encountering network errors when errorPolicy=all', done => {
  let count = 0;
  const expectedError = new ApolloError({ networkError: new Error('network error') });
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation });
    if (count === 0) {
      setTimeout(() =>
        createTodo()
          .then(() => {
            done.fail('Did not expect a result');
          })
          .catch(e => {
            expect(e).toEqual(expectedError);
          }),
      );
    } else if (count === 1) {
      expect(result.loading).toBeTruthy();
    } else if (count === 2) {
      expect(result.error).toEqual(expectedError);
      done();
    }
    count++;
    return <div />;
  };

  const mockError = [
    {
      request: { query: mutation },
      error: new Error('network error'),
    },
  ];

  mount(
    <MockedProvider defaultOptions={{ mutate: { errorPolicy: 'all' } }} mocks={mockError}>
      <Component />
    </MockedProvider>,
  );
});

it('calls the onError prop if the mutation encounters an error', done => {
  let onRenderCalled = false;

  class Component extends React.Component {
    state = {
      mutationError: false,
    };

    onError = (error: Error) => {
      expect(error.message).toMatch('Network error: error occurred');
      onRenderCalled = true;
      this.setState({ mutationError: true });
    };

    render() {
      const { mutationError } = this.state;
      const [result, createTodo] = useMutation({ mutation, onError: this.onError });
      if (!result.called) {
        expect(mutationError).toBe(false);
        setTimeout(() => createTodo());
      }
      if (onRenderCalled) {
        expect(mutationError).toBe(true);
        done();
      }
      return null;
    }
  }

  const mockError = [
    {
      request: { query: mutation },
      error: new Error('error occurred'),
    },
  ];

  mount(
    <MockedProvider mocks={mockError}>
      <Component />
    </MockedProvider>,
  );
});

it('performs a mutation with variables prop', done => {
  const variables = {
    text: 'play tennis',
  };

  let count = 0;
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation, variables });
    if (count === 0) {
      setTimeout(() => {
        createTodo();
      });
    } else if (count === 1) {
      expect(result.loading).toEqual(true);
      expect(result.called).toEqual(true);
    } else if (count === 2) {
      expect(result.loading).toEqual(false);
      expect(result.called).toEqual(true);
      expect(result.data).toEqual(data);
      done();
    }
    count++;
    return <div />;
  };

  const mocks1 = [
    {
      request: { query: mutation, variables },
      result: { data },
    },
  ];

  mount(
    <MockedProvider mocks={mocks1}>
      <Component />
    </MockedProvider>,
  );
});

it('allows passing a variable to the mutate function', done => {
  const variables = {
    text: 'play tennis',
  };

  let count = 0;
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation });
    if (count === 0) {
      setTimeout(() => {
        createTodo({ variables });
      });
    } else if (count === 1) {
      expect(result.loading).toEqual(true);
      expect(result.called).toEqual(true);
    } else if (count === 2) {
      expect(result.loading).toEqual(false);
      expect(result.called).toEqual(true);
      expect(result.data).toEqual(data);
      done();
    }
    count++;
    return <div />;
  };

  const mocks1 = [
    {
      request: { query: mutation, variables },
      result: { data },
    },
  ];

  mount(
    <MockedProvider mocks={mocks1}>
      <Component />
    </MockedProvider>,
  );
});

it('allows an optimistic response prop', done => {
  const link = mockSingleLink(...mocks);
  const client = new ApolloClient({
    link,
    cache,
  });

  const optimisticResponse = {
    createTodo: {
      id: '99',
      text: 'This is an optimistic response',
      completed: false,
      __typename: 'Todo',
    },
    __typename: 'Mutation',
  };

  let count = 0;
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation, optimisticResponse });
    if (count === 0) {
      setTimeout(() => {
        createTodo();
        const dataInStore = client.cache.extract(true);
        expect(dataInStore['Todo:99']).toEqual(optimisticResponse.createTodo);
      });
    } else if (count === 1) {
      expect(result.loading).toEqual(true);
      expect(result.called).toEqual(true);
    } else if (count === 2) {
      expect(result.loading).toEqual(false);
      expect(result.called).toEqual(true);
      expect(result.data).toEqual(data);
      done();
    }
    count++;
    return <div />;
  };
  const context = useProvider({ client });
  mount(<Component />);
});

it('allows passing an optimistic response to the mutate function', done => {
  const link = mockSingleLink(...mocks);
  const client = new ApolloClient({
    link,
    cache,
  });

  const optimisticResponse = {
    createTodo: {
      id: '99',
      text: 'This is an optimistic response',
      completed: false,
      __typename: 'Todo',
    },
    __typename: 'Mutation',
  };

  let count = 0;
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation });
    if (count === 0) {
      setTimeout(() => {
        createTodo({ optimisticResponse });
        const dataInStore = client.cache.extract(true);
        expect(dataInStore['Todo:99']).toEqual(optimisticResponse.createTodo);
      });
    } else if (count === 2) {
      expect(result.loading).toEqual(false);
      expect(result.called).toEqual(true);
      expect(result.data).toEqual(data);
      done();
    }
    count++;
    return <div />;
  };

  const context = useProvider({ client });
  mount(<Component />);
});

it('allows a refetchQueries prop', done => {
  const query = gql`
    query getTodo {
      todo {
        id
        text
        completed
        __typename
      }
      __typename
    }
  `;

  const queryData = {
    todo: {
      id: '1',
      text: 'todo from query',
      completed: false,
      __typename: 'Todo',
    },
    __typename: 'Query',
  };

  const mocksWithQuery = [
    ...mocks,
    // TODO: Somehow apollo-client makes 3 request
    // when refetch queries is enabled??
    {
      request: { query },
      result: { data: queryData },
    },
    {
      request: { query },
      result: { data: queryData },
    },
    {
      request: { query },
      result: { data: queryData },
    },
  ];

  const refetchQueries = [
    {
      query,
    },
  ];

  let count = 0;
  const Component = () => {
    const [resultMutation, createTodo] = useMutation({ mutation, refetchQueries });
    const resultQuery = useQuery({ query });
    if (count === 0) {
      setTimeout(() => {
        createTodo();
      });
    } else if (count === 1) {
      expect(resultMutation.loading).toBe(true);
      expect(resultQuery.loading).toBe(true);
    } else if (count === 2) {
      expect(resultMutation.loading).toBe(true);
      expect(stripSymbols(resultQuery.data)).toEqual(queryData);
      done();
    }
    count++;
    return null;
  };
  mount(
    <MockedProvider mocks={mocksWithQuery}>
      <Component />
    </MockedProvider>,
  );
});

it('allows a refetchQueries prop as string and variables have updated', done => {
  const query = gql`
    query people($first: Int) {
      allPeople(first: $first) {
        people {
          name
        }
      }
    }
  `;

  const peopleData1 = {
    allPeople: { people: [{ name: 'Luke Skywalker', __typename: 'Person' }], __typename: 'People' },
  };
  const peopleData2 = {
    allPeople: { people: [{ name: 'Han Solo', __typename: 'Person' }], __typename: 'People' },
  };
  const peopleData3 = {
    allPeople: { people: [{ name: 'Lord Vader', __typename: 'Person' }], __typename: 'People' },
  };
  const peopleMocks = [
    ...mocks,
    {
      request: { query, variables: { first: 1 } },
      result: { data: peopleData1 },
    },
    {
      request: { query, variables: { first: 2 } },
      result: { data: peopleData2 },
    },
    {
      request: { query, variables: { first: 2 } },
      result: { data: peopleData3 },
    },
  ];

  const refetchQueries = ['people'];

  let count = 0;
  class Component extends React.Component {
    state = {
      variables: {
        first: 1,
      },
    };
    componentDidMount() {
      setTimeout(() => {
        this.setState({
          variables: {
            first: 2,
          },
        });
      }, 50);
    }
    render() {
      const [resultMutation, createTodo] = useMutation({ mutation, refetchQueries });
      const resultQuery = useQuery({ query });
      if (count === 0) {
        // initial loading
        expect(resultQuery.loading).toBe(true);
      } else if (count === 1) {
        // initial loaded
        expect(resultQuery.loading).toBe(false);
      } else if (count === 2) {
        // first: 2 loading
        expect(resultQuery.loading).toBe(true);
      } else if (count === 3) {
        // first: 2 loaded
        expect(resultQuery.loading).toBe(false);
        setTimeout(() => {
          createTodo();
        });
      } else if (count === 4) {
        // mutation loading
        expect(resultMutation.loading).toBe(true);
      } else if (count === 5) {
        // mutation loaded
        expect(resultMutation.loading).toBe(false);
      } else if (count === 6) {
        // query refetched
        expect(resultQuery.loading).toBe(false);
        expect(resultMutation.loading).toBe(false);
        expect(stripSymbols(resultQuery.data)).toEqual(peopleData3);
        done();
      }
      count++;
      return null;
    }
  }

  mount(
    <MockedProvider mocks={peopleMocks}>
      <Component />
    </MockedProvider>,
  );
});

it('allows refetchQueries to be passed to the mutate function', done => {
  const query = gql`
    query getTodo {
      todo {
        id
        text
        completed
        __typename
      }
      __typename
    }
  `;

  const queryData = {
    todo: {
      id: '1',
      text: 'todo from query',
      completed: false,
      __typename: 'Todo',
    },
    __typename: 'Query',
  };

  const mocksWithQuery = [
    ...mocks,
    // TODO: Somehow apollo-client makes 3 request
    // when refetch queries is enabled??
    {
      request: { query },
      result: { data: queryData },
    },
    {
      request: { query },
      result: { data: queryData },
    },
    {
      request: { query },
      result: { data: queryData },
    },
  ];

  const refetchQueries = [
    {
      query,
    },
  ];

  let count = 0;
  const Component = () => {
    const [resultMutation, createTodo] = useMutation({ mutation });
    const resultQuery = useQuery({ query });
    if (count === 0) {
      setTimeout(() => {
        createTodo({ refetchQueries });
      });
    } else if (count === 1) {
      expect(resultMutation.loading).toBe(true);
      expect(resultQuery.loading).toBe(true);
    } else if (count === 2) {
      expect(resultMutation.loading).toBe(true);
      expect(stripSymbols(resultQuery.data)).toEqual(queryData);
      done();
    }
    count++;
    return null;
  };

  mount(
    <MockedProvider mocks={mocksWithQuery}>
      <Component />
    </MockedProvider>,
  );
});

it('has an update prop for updating the store after the mutation', done => {
  const update = (_proxy: DataProxy, response: ExecutionResult) => {
    expect(response.data).toEqual(data);
  };

  let count = 0;
  const Component = () => {
    const [_, createTodo] = useMutation({ mutation, update });
    if (count === 0) {
      setTimeout(() => {
        createTodo().then((response: any) => {
          expect(response!.data).toEqual(data);
          done();
        });
      });
    }
    count++;
    return null;
  };

  mount(
    <MockedProvider mocks={mocks}>
      <Component />
    </MockedProvider>,
  );
});

it('allows update to be passed to the mutate function', done => {
  const update = (_proxy: DataProxy, response: ExecutionResult) => {
    expect(response.data).toEqual(data);
  };

  let count = 0;
  const Component = () => {
    const [_, createTodo] = useMutation({ mutation, update });
    if (count === 0) {
      setTimeout(() => {
        createTodo({ update }).then((response: any) => {
          expect(response!.data).toEqual(data);
          done();
        });
      });
    }
    count++;
    return null;
  };

  mount(
    <MockedProvider mocks={mocks}>
      <Component />
    </MockedProvider>,
  );
});

it('allows for overriding the options passed in the props by passing them in the mutate function', done => {
  const variablesProp = {
    text: 'play tennis',
  };

  const variablesMutateFn = {
    text: 'go swimming',
  };

  let count = 0;
  const Component = () => {
    const [result, createTodo] = useMutation({ mutation, variables: variablesProp });
    if (count === 0) {
      setTimeout(() => {
        createTodo({ variables: variablesMutateFn });
      });
    } else if (count === 2) {
      expect(result.loading).toEqual(false);
      expect(result.called).toEqual(true);
      expect(result.data).toEqual(data2);
      done();
    }
    count++;
    return <div />;
  };

  const mocks1 = [
    {
      request: { query: mutation, variables: variablesProp },
      result: { data },
    },
    {
      request: { query: mutation, variables: variablesMutateFn },
      result: { data: data2 },
    },
  ];

  mount(
    <MockedProvider mocks={mocks1}>
      <Component />
    </MockedProvider>,
  );
});

it('updates if the client changes', done => {
  const link1 = mockSingleLink({
    request: { query: mutation },
    result: { data },
  });
  const client1 = new ApolloClient({
    link: link1,
    cache: new Cache({ addTypename: false }),
  });

  const data3 = {
    createTodo: {
      __typename: 'Todo',
      id: '100',
      text: 'After updating client.',
      completed: false,
    },
    __typename: 'Mutation',
  };

  const link2 = mockSingleLink({
    request: { query: mutation },
    result: { data: data3 },
  });

  const client2 = new ApolloClient({
    link: link2,
    cache: new Cache({ addTypename: false }),
  });

  let count = 0;
  class Component extends React.Component {
    state = {
      client: client1,
    };

    render() {
      const context = useProvider({ client: this.state.client });
      const [result, createTodo] = useMutation({ mutation });
      if (count === 0) {
        expect(result.called).toEqual(false);
        expect(result.loading).toEqual(false);
        setTimeout(() => {
          createTodo();
        });
      } else if (count === 2 && result) {
        expect(result.data).toEqual(data);
        setTimeout(() => {
          this.setState({
            client: client2,
          });
        });
      } else if (count === 3) {
        expect(result.called).toEqual(false);
        expect(result.loading).toEqual(false);
        setTimeout(() => {
          createTodo();
        });
      } else if (count === 5) {
        expect(result.data).toEqual(data3);
        done();
      }
      count++;
      return null;
    }
  }

  mount(<Component />);
});

it('uses client from props instead of one provided by context', () => {
  const link1 = mockSingleLink({
    request: { query: mutation },
    result: { data },
  });
  const client1 = new ApolloClient({
    link: link1,
    cache: new Cache({ addTypename: false }),
  });

  const link2 = mockSingleLink({
    request: { query: mutation },
    result: { data: data2 },
  });
  const client2 = new ApolloClient({
    link: link2,
    cache: new Cache({ addTypename: false }),
  });

  let count = 0;

  const context = useProvider({ client: client1 });
  const [result, createTodo] = useMutation({ client: client2, mutation });
  if (!result.called) {
    setTimeout(() => {
      createTodo();
    });
  }

  if (count === 2) {
    expect(result.loading).toEqual(false);
    expect(result.called).toEqual(true);
    expect(result.data).toEqual(data2);
  }

  count++;
  mount(<div />);
});

it('errors if a query is passed instead of a mutation', () => {
  const query = gql`
    query todos {
      todos {
        id
      }
    }
  `;

  // Prevent error from being logged in console of test.
  const errorLogger = console.error;
  console.error = () => {}; // tslint:disable-line

  expect(() => {
    const [result, createTodo] = useMutation({ mutation: query });
    mount(
      <MockedProvider>
        <div>x</div>
      </MockedProvider>,
    );
  }).toThrowError('The <Mutation /> component requires a graphql mutation, but got a query.');

  console.log = errorLogger; // tslint:disable-line
});

it('errors when changing from mutation to a query', done => {
  const query = gql`
    query todos {
      todos {
        id
      }
    }
  `;

  class Component extends React.Component {
    state = {
      query: mutation,
    };

    componentDidCatch(e: Error) {
      expect(e).toEqual(
        new Error('The <Mutation /> component requires a graphql mutation, but got a query.'),
      );
      done();
    }
    render() {
      const [result, createTodo] = useMutation({ mutation: this.state.query });
      return () => {
        setTimeout(() => {
          this.setState({
            query,
          });
        });
        return null;
      };
    }
  }

  // Prevent error from being logged in console of test.
  const errorLogger = console.error;
  console.error = () => {}; // tslint:disable-line

  mount(
    <MockedProvider>
      <Component />
    </MockedProvider>,
  );

  console.log = errorLogger; //tslint:disable-line
});

it('errors if a subscription is passed instead of a mutation', () => {
  const subscription = gql`
    subscription todos {
      todos {
        id
      }
    }
  `;

  // Prevent error from being logged in console of test.
  const errorLogger = console.error;
  console.error = () => {}; // tslint:disable-line

  expect(() => {
    const [result, createTodo] = useMutation({ mutation: subscription });
    mount(
      <MockedProvider>
        {/* <Mutation mutation={subscription}>{() => null}</Mutation> */}
      </MockedProvider>,
    );
  }).toThrowError(
    'The <Mutation /> component requires a graphql mutation, but got a subscription.',
  );

  console.log = errorLogger; // tslint:disable-line
});

it('errors when changing from mutation to a subscription', done => {
  const subscription = gql`
    subscription todos {
      todos {
        id
      }
    }
  `;

  class Component extends React.Component {
    state = {
      query: mutation,
    };

    componentDidCatch(e: Error) {
      expect(e).toEqual(
        new Error(
          'The <Mutation /> component requires a graphql mutation, but got a subscription.',
        ),
      );
      done();
    }
    render() {
      const [result, createTodo] = useMutation({ mutation });
      setTimeout(() => {
        this.setState({
          query: subscription,
        });
      });
      return null;
    }
  }

  // Prevent error from being logged in console of test.
  const errorLogger = console.error;
  console.error = () => {}; // tslint:disable-line

  mount(
    <MockedProvider>
      <Component />
    </MockedProvider>,
  );

  console.log = errorLogger; // tslint:disable-line
});

it('does not update state after receiving data after it has been unmounted', done => {
  let success = false;
  let original = console.error;
  console.error = jest.fn();
  const checker = () => {
    setTimeout(() => {
      expect(console.error).not.toHaveBeenCalled();
      console.error = original;
      success = true;
      done();
    }, 100);
  };

  class Component extends React.Component {
    state = {
      called: false,
    };

    render() {
      const { called } = this.state;
      if (called === true) {
        return null;
      } else {
        const [result, createTodo] = useMutation({ mutation });
        if (!result.called) {
          setTimeout(() => {
            createTodo();
            this.setState({ called: true }, checker);
          });
        }

        return null;
      }
    }
  }

  mount(
    <MockedProvider mocks={mocks}>
      <Component />
    </MockedProvider>,
  );

  setTimeout(() => {
    if (!success) done.fail('timeout passed');
  }, 200);
});

it('does not update state after receiving error after it has been unmounted', done => {
  let original = console.error;
  console.error = jest.fn();
  const checker = () => {
    setTimeout(() => {
      expect(console.error).not.toHaveBeenCalled();
      console.error = original;
      done();
    }, 100);
  };

  class Component extends React.Component {
    state = {
      called: false,
    };

    render() {
      const { called } = this.state;
      if (called === true) {
        return null;
      } else {
        const [result, createTodo] = useMutation({ mutation });
        if (!result.called) {
          setTimeout(() => {
            createTodo().catch(() => {}); // tslint:disable-line
            this.setState({ called: true }, checker);
          }, 10);
        }
        return null;
      }
    }
  }

  const mockError = [
    {
      request: { query: mutation },
      error: new Error('error occurred'),
    },
  ];

  const wrapper = mount(
    <MockedProvider mocks={mockError}>
      <Component />
    </MockedProvider>,
  );
});
