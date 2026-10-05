import { useCallback, useEffect, useRef, useState } from 'react';
import { Entities } from '@uipath/uipath-typescript/entities';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONFIG } from '@/config/app';
import { DECISION_WRITE_FIELDS, UI_DEPENDENT_FIELDS, type FieldName } from './fields';
import { toAppError, type AppError } from './errors';

/**
 * Live schema of AP_Invoice_Carlos via `entities.getByName` (DataFabric.Schema.Read).
 * Lets the UI tell "field not in schema" apart from "no data yet".
 */
export interface SchemaState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Lower-cased field names present on the entity. */
  fieldNames: Set<string>;
  /** True while loading or when present; false only when the schema is known and the field is absent. */
  has: (f: FieldName) => boolean;
  missingUiFields: FieldName[];
  canWriteDecision: boolean;
  error: AppError | null;
  reload: () => Promise<void>;
}

export function useSchema(): SchemaState {
  const { sdk, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<SchemaState['status']>('idle');
  const [fieldNames, setFieldNames] = useState<Set<string>>(new Set());
  const [error, setError] = useState<AppError | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!isAuthenticated || inFlight.current) return;
    inFlight.current = true;
    setStatus('loading');
    setError(null);
    try {
      const entity = await new Entities(sdk).getByName(APP_CONFIG.entityName);
      setFieldNames(new Set(entity.fields.map((f) => f.name.toLowerCase())));
      setStatus('ready');
    } catch (err) {
      setError(toAppError(err, 'Unable to read the entity schema.'));
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
  }, [sdk, isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const has = useCallback(
    (f: FieldName) => status !== 'ready' || fieldNames.has(f.toLowerCase()),
    [status, fieldNames],
  );
  const missingUiFields = status === 'ready' ? UI_DEPENDENT_FIELDS.filter((f) => !has(f)) : [];
  const canWriteDecision = status === 'ready' && DECISION_WRITE_FIELDS.every(has);

  return { status, fieldNames, has, missingUiFields, canWriteDecision, error, reload: load };
}
