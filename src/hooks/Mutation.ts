import ApolloClient, { PureQueryOptions, ApolloError } from 'apollo-client';
import { MutationProps, MutationContext, MutationOptions, ExecutionResult } from '../Mutation';
import { OperationVariables } from '../types';
import { getClient } from '../component-utils';
import { DocumentNode } from 'graphql';
import { parser, DocumentType } from '../parser';
const invariant = require('invariant');

const initialState = {
  loading: false,
  called: false,
  error: undefined,
  data: undefined,
};

class Mutation<TData = any, TVariables = OperationVariables> {
  private client: ApolloClient<any>;
  private mostRecentMutationId: number;
  private state: any;
  private hasMounted: boolean = false;

  constructor(public props: MutationProps<TData, TVariables>, public context: MutationContext) {
    this.props = props;
    this.context = context;
    this.client = getClient(props, context);
    this.verifyDocumentIsMutation(props.mutation);
    this.mostRecentMutationId = 0;
    this.state = initialState;
  }

  setState(state: any, cb?: Function) {
    this.state = {
      ...this.state,
      ...state,
    };
    if (cb) {
      cb();
    }
  }

  // used by hook
  start() {
    this.hasMounted = true;
  }

  // used by hook
  finish() {
    this.hasMounted = false;
  }

  // render
  // use by hook
  api() {
    const { loading, data, error, called } = this.state;

    return {
      called,
      loading,
      data,
      error,
      client: this.client,
      runMutation: this.runMutation,
    };
  }

  private runMutation = (options: MutationOptions<TData, TVariables> = {}) => {
    this.onMutationStart();
    const mutationId = this.generateNewMutationId();

    return this.mutate(options)
      .then(response => {
        this.onMutationCompleted(response, mutationId);
        return response;
      })
      .catch(e => {
        this.onMutationError(e, mutationId);
        if (!this.props.onError) throw e;
      });
  };

  private mutate = (options: MutationOptions<TData, TVariables>) => {
    const {
      mutation,
      variables,
      optimisticResponse,
      update,
      context = {},
      awaitRefetchQueries = false,
    } = this.props;
    const mutateOptions = { ...options };

    let refetchQueries = mutateOptions.refetchQueries || this.props.refetchQueries;
    // XXX this will be removed in the 3.0 of Apollo Client. Currently, we
    // support refectching of named queries which just pulls the latest
    // variables to match. This forces us to either a) keep all queries around
    // to be able to iterate over and refetch, or b) [new in 2.1] keep a map of
    // operations on the client where operation name => { query, variables }
    //
    // Going forward, we should only allow using the full operation + variables to
    // refetch.
    if (refetchQueries && refetchQueries.length && Array.isArray(refetchQueries)) {
      refetchQueries = (refetchQueries as any).map((x: string | PureQueryOptions) => {
        if (typeof x === 'string' && this.context.operations)
          return this.context.operations.get(x) || x;
        return x;
      });
      delete mutateOptions.refetchQueries;
    }

    const mutateVariables = Object.assign({}, variables, mutateOptions.variables);
    delete mutateOptions.variables;

    return this.client.mutate({
      mutation,
      optimisticResponse,
      refetchQueries,
      awaitRefetchQueries,
      update,
      context,
      variables: mutateVariables,
      ...mutateOptions,
    });
  };

  private onMutationStart = () => {
    if (!this.state.loading && !this.props.ignoreResults) {
      this.setState({
        loading: true,
        error: undefined,
        data: undefined,
        called: true,
      });
    }
  };

  private onMutationCompleted = (response: ExecutionResult<TData>, mutationId: number) => {
    if (this.hasMounted === false) {
      return;
    }
    const { onCompleted, ignoreResults } = this.props;

    const { data, errors } = response;
    const error =
      errors && errors.length > 0 ? new ApolloError({ graphQLErrors: errors }) : undefined;

    const callOncomplete = () => (onCompleted ? onCompleted(data as TData) : null);

    if (this.isMostRecentMutation(mutationId) && !ignoreResults) {
      this.setState({ loading: false, data, error }, callOncomplete);
    } else {
      callOncomplete();
    }
  };

  private onMutationError = (error: ApolloError, mutationId: number) => {
    if (this.hasMounted === false) {
      return;
    }
    const { onError } = this.props;
    const callOnError = () => (onError ? onError(error) : null);

    if (this.isMostRecentMutation(mutationId)) {
      this.setState({ loading: false, error }, callOnError);
    } else {
      callOnError();
    }
  };

  private generateNewMutationId = (): number => {
    this.mostRecentMutationId = this.mostRecentMutationId + 1;
    return this.mostRecentMutationId;
  };

  private isMostRecentMutation = (mutationId: number) => {
    return this.mostRecentMutationId === mutationId;
  };

  private verifyDocumentIsMutation = (mutation: DocumentNode) => {
    const operation = parser(mutation);
    invariant(
      operation.type === DocumentType.Mutation,
      `The <Mutation /> component requires a graphql mutation, but got a ${
        operation.type === DocumentType.Query ? 'query' : 'subscription'
      }.`,
    );
  };
}

export default Mutation;
