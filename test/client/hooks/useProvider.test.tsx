import * as React from 'react';
import { useState } from 'react';
import * as PropTypes from 'prop-types';
import { shallow } from 'enzyme';
import * as TestUtils from 'react-dom/test-utils';
import ApolloClient from 'apollo-client';
import { InMemoryCache as Cache } from 'apollo-cache-inmemory';
import { ApolloLink } from 'apollo-link';
import { useProvider } from '../../../src/hooks';

describe('<ApolloProvider /> Component', () => {
  const client = new ApolloClient({
    cache: new Cache(),
    link: new ApolloLink((o, f) => (f ? f(o) : null)),
  });

  interface ChildContext {
    client: Object;
  }

  function Child(props: any) {
    if (props.data) props.data.refetch();
    return null;
  }

  interface Props {
    client: ApolloClient<any>;
  }

  function Container(props: Props) {
    const state: any = useState({});
    const context = useProvider({ client: state.client || props.client }, {});
    return <Child />;
  }

  it('should render children components', () => {
    const wrapper = shallow(
      <Container client={client}>
        <div className="unique" />
      </Container>,
    );

    expect(wrapper.contains(<div className="unique" />)).toBeTruthy();
  });

  it('should support the 2.0', () => {
    const wrapper = shallow(<Container client={{} as ApolloClient<any>} />);
    expect(wrapper.contains(<div className="unique" />)).toBeTruthy();
  });

  it('should require a client', () => {
    const originalConsoleError = console.error;
    console.error = () => {
      /* noop */
    };
    expect(() => {
      shallow(
        <Container client={undefined as any}>
          <div className="unique" />
        </Container>,
      );
    }).toThrowError(
      'ApolloProvider was not passed a client instance. Make ' +
        'sure you pass in your client via the "client" prop.',
    );
    console.error = originalConsoleError;
  });

  it('should not require a store', () => {
    const wrapper = shallow(
      <Container client={client}>
        <div className="unique" />
      </Container>,
    );
    expect(wrapper.contains(<div className="unique" />)).toBeTruthy();
  });

  it('should add the client to the children context', () => {
    const tree = TestUtils.renderIntoDocument(
      <Container client={client}>
        <Child />
        <Child />
      </Container>,
    ) as React.Component<any, any>;
  });

  it('should update props when the client changes', () => {
    const container = shallow(<Container client={client} />);
    const newClient = new ApolloClient({
      cache: new Cache(),
      link: new ApolloLink((o, f) => (f ? f(o) : null)),
    });
    container.setState({ client: newClient });
    // expect
  });

  it('child component should be able to query new client when props change', () => {
    const container = TestUtils.renderIntoDocument(
      <Container client={client} />,
    ) as React.Component<any, any>;

    const newClient = new ApolloClient({
      cache: new Cache(),
      link: new ApolloLink((o, f) => (f ? f(o) : null)),
    });

    container.setState({ client: newClient });

    expect(container.context.client).toEqual(newClient);
    expect(container.context.client).not.toEqual(client);
  });
});
