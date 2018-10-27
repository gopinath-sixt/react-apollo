import Query from './Mutation';

export function useQuery(props: any, context: any) {
  const query = new Query(props, context);
}
