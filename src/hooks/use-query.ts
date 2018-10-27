import { useEffect } from 'react';
import Query from './Query';
import { OperationVariables } from '../types';
import { QueryProps, QueryContext } from '../Query';

export function useQuery(props: QueryProps<any, OperationVariables>, context: QueryContext) {
  const query = new Query(props, context);
  useEffect(() => {
    query.start();
    return () => {
      query.finish();
    };
  });

  return query.api();
}
