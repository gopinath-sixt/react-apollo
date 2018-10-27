import { useEffect } from 'react';
import Mutation from './Mutation';
import { OperationVariables } from '../types';
import { MutationProps, MutationContext } from '../Mutation';

export function useMutation(
  props: MutationProps<any, OperationVariables>,
  context: MutationContext,
) {
  const mutation = new Mutation(props, context);
  useEffect(() => {
    mutation.start();
    return () => {
      mutation.finish();
    };
  });
  return mutation.api();
}
