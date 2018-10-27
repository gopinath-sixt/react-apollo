import { useContext } from 'react';
import ApolloProvider, { ApolloProviderProps } from './Provider';

export function useProvider(props: ApolloProviderProps<any>, context: any) {
  const provider = new ApolloProvider(props, context);
  return useContext(provider.context);
}
