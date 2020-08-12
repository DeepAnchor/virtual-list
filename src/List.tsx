import * as React from 'react';
import classNames from 'classnames';
import Filler from './Filler';
import { RenderFunc, SharedConfig, GetKey } from './interface';
import { useChildren } from './hooks/useChildren';
import { useHeights } from './hooks/useHeights';

const EMPTY_DATA = [];

const ScrollStyle = {
  overflowY: 'auto',
  overflowAnchor: 'none',
};

export type ScrollAlign = 'top' | 'bottom' | 'auto';
export type ScrollConfig =
  | {
      index: number;
      align?: ScrollAlign;
    }
  | {
      key: React.Key;
      align?: ScrollAlign;
    };
export type ListRef = {
  scrollTo: number | ScrollConfig;
};

export interface ListProps<T> extends React.HTMLAttributes<any> {
  prefixCls?: string;
  children: RenderFunc<T>;
  data: T[];
  height?: number;
  itemHeight?: number;
  /** If not match virtual scroll condition, Set List still use height of container. */
  fullHeight?: boolean;
  itemKey: React.Key | ((item: T) => React.Key);
  component?: string | React.FC<any> | React.ComponentClass<any>;
  /** Disable scroll check. Usually used on animation control */
  disabled?: boolean;
  /** Set `false` will always use real scroll instead of virtual one */
  virtual?: boolean;

  /** When `disabled`, trigger if changed item not render. */
  onSkipRender?: () => void;
  onScroll?: React.UIEventHandler<HTMLElement>;
}

function RawList<T>(props: ListProps<T>, ref) {
  const {
    prefixCls,
    className,
    height,
    itemHeight,
    fullHeight = true,
    style,
    data,
    children,
    itemKey,
    virtual,
    component: Component = 'div',
    ...restProps
  } = props;

  const mergedData = data || EMPTY_DATA;
  const componentRef = React.useRef<HTMLElement>();

  const inVirtual =
    virtual !== false && height && itemHeight && data && itemHeight * data.length > height;
  const [collectHeight, heights, heightUpdatedMark] = useHeights();

  const [scrollTop, setScrollTop] = React.useState(0);

  const mergedClassName = classNames(prefixCls, className);

  const getKey = React.useCallback<GetKey<T>>(
    (item: T) => {
      if (typeof itemKey === 'function') {
        return itemKey(item);
      }
      return item[itemKey];
    },
    [itemKey],
  );

  const sharedConfig: SharedConfig<T> = {
    getKey,
  };

  // ========================== Visible Calculation =========================
  const { scrollHeight, start, end, offset } = React.useMemo(() => {
    let itemTop = 0;
    let startIndex: number;
    let startOffset: number;
    let endIndex: number;

    for (let i = 0; i < mergedData.length; i += 1) {
      const item = mergedData[i];
      const key = getKey(item);

      const currentItemBottom = itemTop + (heights.get(key) ?? itemHeight);

      // Check item top in the range
      if (currentItemBottom >= scrollTop && startIndex === undefined) {
        startIndex = i;
        startOffset = itemTop;
      }

      // Check item bottom in the range. We will render additional one item for motion usage
      if (currentItemBottom > scrollTop + height && endIndex === undefined) {
        endIndex = i;
      }

      itemTop = currentItemBottom;
    }

    // Fallback to normal if not match
    if (startIndex === undefined) {
      startIndex = 0;
      startOffset = 0;
    }
    if (endIndex === undefined) {
      endIndex = mergedData.length - 1;
    }

    // Give cache to improve scroll experience
    endIndex = Math.min(endIndex + 1, mergedData.length);

    return {
      scrollHeight: itemTop,
      start: startIndex,
      end: endIndex,
      offset: startOffset,
    };
  }, [scrollTop, mergedData, heightUpdatedMark]);

  // ================================ Scroll ================================
  function onRawScroll(event: UIEvent) {
    if (!inVirtual) return;

    let { scrollTop: top } = event.target as HTMLElement;
    top = Math.max(0, top);
    top = Math.min(top, scrollHeight - height);
    setScrollTop(top);
  }

  // React.useEffect(() => {
  //   componentRef.current.addEventListener('scroll', onRawScroll);
  // }, []);

  // ================================ Render ================================
  const listChildren = useChildren(mergedData, start, end, collectHeight, children, sharedConfig);
  console.log('>>>', start, end, offset, listChildren);

  return (
    <>
      {start}/{end}-{scrollTop}
      <Component
        style={
          height
            ? { ...style, [fullHeight ? 'height' : 'maxHeight']: height, ...ScrollStyle }
            : style
        }
        className={mergedClassName}
        {...restProps}
        ref={componentRef}
        onScroll={onRawScroll}
        // onScroll={this.onRawScroll}
        // ref={this.listRef}
      >
        <Filler prefixCls={prefixCls} height={scrollHeight} offset={offset}>
          {listChildren}
        </Filler>
      </Component>
    </>
  );
}

const List = React.forwardRef<ListRef, ListProps<any>>(RawList);

List.displayName = 'List';

export default List as <Item = any>(
  props: React.PropsWithChildren<ListProps<Item>> & { ref?: React.Ref<ListRef> },
) => React.ReactElement;
