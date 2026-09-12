import { memo, useCallback, useSyncExternalStore, type ComponentProps } from 'react'
import { SegmentView } from './SegmentView'
import type { SegmentTokenStore } from './segment-token-store'

type Props = Omit<ComponentProps<typeof SegmentView>, 'tokens'> & {
  tokenStore: SegmentTokenStore
}

export const TokenizedSegment = memo(function TokenizedSegment({
  tokenStore,
  ...props
}: Props): React.JSX.Element {
  const seq = props.seg.seq
  const subscribe = useCallback((listener: () => void) => tokenStore.subscribe(seq, listener), [tokenStore, seq])
  const snapshot = useCallback(() => tokenStore.get(seq), [tokenStore, seq])
  const tokens = useSyncExternalStore(subscribe, snapshot, snapshot)
  return <SegmentView {...props} tokens={tokens} />
})
