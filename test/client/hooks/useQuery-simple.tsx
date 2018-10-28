import * as React from 'react';
import ApolloClient, { ApolloError, NetworkStatus } from 'apollo-client';
import { mount, ReactWrapper } from 'enzyme';
import { InMemoryCache as Cache } from 'apollo-cache-inmemory';
import { useProvider, useQuery } from '../../../src/hooks';
import { MockedProvider, mockSingleLink } from '../../../src/test-utils';
import catchAsyncError from '../../test-utils/catchAsyncError';
import stripSymbols from '../../test-utils/stripSymbols';
import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';

const allPeopleQuery: DocumentNode = gql`
  query people {
    allPeople(first: 1) {
      people {
        name
      }
    }
  }
`;

interface Data {
  allPeople: {
    people: Array<{ name: string }>;
  };
}

const allPeopleData: Data = {
  allPeople: { people: [{ name: 'Luke Skywalker' }] },
};

describe('Query component', () => {
  let wrapper: ReactWrapper<any, any> | null;
  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  it('calls the children prop', done => {
    const link = mockSingleLink({
      request: { query: allPeopleQuery },
      result: { data: allPeopleData },
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    const Component = (props: any) => {
      const result = useQuery({ query: allPeopleQuery, ...props });

      catchAsyncError(done, () => {
        const { client: clientResult, ...rest } = result;

        if (result.loading) {
          expect(rest).toMatchSnapshot('result in render prop while loading');
          expect(clientResult).toBe(client);
        } else {
          expect(stripSymbols(rest)).toMatchSnapshot('result in render prop');
          done();
        }
      });
      return null;
    };

    const context = useProvider({ client });
    wrapper = mount(<Component context={context} />);
  });

  describe('result provides', () => {
    it('client', done => {
      const queryWithVariables: DocumentNode = gql`
        query people($first: Int) {
          allPeople(first: $first) {
            people {
              name
            }
          }
        }
      `;

      const mocksWithVariable = [
        {
          request: {
            query: queryWithVariables,
            variables: {
              first: 1,
            },
          },
          result: { data: allPeopleData },
        },
      ];

      const variables = {
        first: 1,
      };

      const Component = () => {
        const result = useQuery({ query: queryWithVariables, variables });
        catchAsyncError(done, () => {
          expect(result.client).toBeInstanceOf(ApolloClient);
          done();
        });
        return null;
      };

      wrapper = mount(
        <MockedProvider mocks={mocksWithVariable}>
          <Component />
        </MockedProvider>,
      );
    });

    it('error', done => {
      const mockError = [
        {
          request: { query: allPeopleQuery },
          error: new Error('error occurred'),
        },
      ];

      const Component = () => {
        const result = useQuery({ query: allPeopleQuery });
        if (result.loading) {
          return null;
        }
        catchAsyncError(done, () => {
          expect(result.error).toEqual(new Error('Network error: error occurred'));
          done();
        });
        return null;
      };

      wrapper = mount(
        <MockedProvider mocks={mockError}>
          <Component />
        </MockedProvider>,
      );
    });
  });
});
