import * as React from 'react';
import ApolloClient from 'apollo-client';
import { DocumentNode } from 'graphql';

const invariant = require('invariant');

export interface ApolloProviderProps<TCache> {
  client: ApolloClient<TCache>;
}

export default class ApolloProvider<TCache> {
  public context: any;
  protected _context: any;
  private operations: Map<string, { query: DocumentNode; variables: any }> = new Map();

  constructor(protected props: ApolloProviderProps<TCache>, context?: any) {
    invariant(
      props.client,
      'ApolloProvider was not passed a client instance. Make ' +
        'sure you pass in your client via the "client" prop.',
    );

    this._context = context;

    // we have to attach to the client since you could have multiple
    // providers
    // XXX this is backwards compat and will be removed in 3.0
    if (!(props.client as any).__operations_cache__) {
      (props.client as any).__operations_cache__ = this.operations;
    }

    this.context = React.createContext({
      client: this.props.client,
      operations: (this.props.client as any).__operations_cache__,
    });
  }
}
