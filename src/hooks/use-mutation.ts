import Mutation from './Mutation';

export function useMutation(props: any, context: any) {
  const mutation = new Mutation(props, context);
}
