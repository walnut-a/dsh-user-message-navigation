import {
  useCallback, useEffect, useRef, useState,
  type CSSProperties, type PointerEvent as ReactPointerEvent,
} from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import {
  arrivalFeedbackKeyframes, easeOutQuart, isMarkerActivationKey, markerIndexAtY, previewText,
  scrollTopForMarker, shouldSmoothMarkerDistance, type UserMessageMarker,
} from './runtime.ts'

const MINIMUM_MESSAGES = 4
const RAIL_WIDTH = 36
const RAIL_TOP_INSET = 8
const RAIL_BOTTOM_INSET = 16
const RAIL_MIN_HEIGHT = 40
// Adaptive density: ROW_MAX is the looser spacing for a few messages, ROW_MIN
// the dense floor as the count grows, MAX_EXTENT the strip's designed height.
const RAIL_ROW_MAX = 24
const RAIL_ROW_MIN = 8
const RAIL_MAX_EXTENT = 320
const NEARBY_SCROLL_DURATION_MS = 240
const ARRIVAL_FEEDBACK_DURATION_MS = 1_100
// Left inset of the first view tab from the scrollport's left edge
// (ConversationRoot `.header` padding-left 20px + `.tabs` padding-left 8px).
const TAB_LEFT_INSET = 28
// Visible tick width, matching the injected `button > span { width: 11px }`.
const TICK_WIDTH = 11

interface RailGeometry {
  readonly left: number
  readonly top: number
  readonly height: number
}

type NavigationRailProps = PropsRuntime<'shell.overlay'>

function scrollerFor(flow: HTMLElement): HTMLElement | null {
  return flow.closest<HTMLElement>('[data-conversation-scroll]')
}

function readMarkers(flow: HTMLElement): readonly UserMessageMarker[] {
  return [...flow.querySelectorAll<HTMLElement>('[data-chat-flow-kind="user"][data-chat-anchor-key]')]
    .flatMap((element, index) => {
      const key = element.dataset.chatAnchorKey
      return key === undefined ? [] : [{
        key,
        label: previewText(element.innerText),
        element,
        ordinal: index + 1,
      }]
    })
}

function feedbackSurfaceFor(marker: UserMessageMarker): HTMLElement {
  return marker.element.querySelector<HTMLElement>('[class*="_bubble"]') ?? marker.element
}

function railGeometry(flow: HTMLElement, scroller: HTMLElement, markerCount: number): RailGeometry | null {
  const flowRect = flow.getBoundingClientRect()
  const scrollerRect = scroller.getBoundingClientRect()
  const available = flowRect.left - scrollerRect.left
  if (available < 28 || scrollerRect.height < 160) return null
  // Adaptive density: the per-tick row height loosens toward RAIL_ROW_MAX for a
  // few messages and tightens toward RAIL_ROW_MIN as the count grows, so the
  // strip reads as gradually filling up. The height grows with the count (up to
  // the scrollport) and the strip stays vertically centered.
  const maxExtent = scrollerRect.height - RAIL_TOP_INSET - RAIL_BOTTOM_INSET
  const row = Math.max(RAIL_ROW_MIN, Math.min(RAIL_ROW_MAX, RAIL_MAX_EXTENT / markerCount))
  const height = Math.max(RAIL_MIN_HEIGHT, Math.min(maxExtent, markerCount * row))
  const top = scrollerRect.top + (scrollerRect.height - height) / 2
  // Optical alignment: the visible tick column is centered inside the wider
  // nav (RAIL_WIDTH), so align the tick's left edge — not the nav box — to the
  // first view tab, and never overlap the chat column.
  const opticalLeftOffset = (RAIL_WIDTH - TICK_WIDTH) / 2
  const tabLeft = scrollerRect.left + TAB_LEFT_INSET
  const contentBoundary = flowRect.left - RAIL_WIDTH - 8
  const left = Math.round(Math.max(
    scrollerRect.left,
    Math.min(tabLeft - opticalLeftOffset, contentBoundary),
  ))
  return {
    left,
    top: Math.round(top),
    height: Math.round(height),
  }
}

function activeMarker(markers: readonly UserMessageMarker[], scroller: HTMLElement): number {
  const top = scroller.getBoundingClientRect().top + 24
  let active = 0
  for (let index = 0; index < markers.length; index += 1) {
    if (markers[index]!.element.getBoundingClientRect().top <= top) active = index
    else break
  }
  return active
}

function NavigationRail(_props: NavigationRailProps) {
  const [markers, setMarkers] = useState<readonly UserMessageMarker[]>([])
  const [tickTops, setTickTops] = useState<readonly number[]>([])
  const [active, setActive] = useState(0)
  const [geometry, setGeometry] = useState<RailGeometry | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const pressed = useRef(false)
  const dragging = useRef(false)
  const dragStartY = useRef(0)
  const lastDragged = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const scrollFrame = useRef(0)
  const feedbackTimer = useRef(0)
  const feedbackAnimation = useRef<Animation | null>(null)

  const refresh = useCallback(() => {
    const flow = document.querySelector<HTMLElement>('[data-chat-flow]')
    if (flow === null) {
      setMarkers([])
      setTickTops([])
      setGeometry(null)
      return
    }
    const scroller = scrollerFor(flow)
    if (scroller === null) return
    const next = readMarkers(flow)
    const extent = railGeometry(flow, scroller, next.length)
    if (extent === null) {
      setMarkers([])
      setTickTops([])
      setGeometry(null)
      return
    }
    // Even distribution across the dense rail: each tick owns an equal slice,
    // so the rail fills uniformly and densifies once it caps at the scrollport.
    const tops = next.length === 0
      ? []
      : next.map((_, index) => Math.round((index + 0.5) * extent.height / next.length))
    setMarkers(next)
    setTickTops(tops)
    setGeometry(extent)
    setActive(activeMarker(next, scroller))
  }, [])

  useEffect(() => {
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(refresh)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    refresh()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [refresh])

  useEffect(() => () => {
    cancelAnimationFrame(scrollFrame.current)
    window.clearTimeout(feedbackTimer.current)
    feedbackAnimation.current?.cancel()
  }, [])

  const jumpTo = useCallback((index: number, smooth: boolean, feedback = true) => {
    const marker = markers[index]
    if (marker === undefined) return
    const scroller = scrollerFor(marker.element)
    if (scroller === null) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const markerRect = marker.element.getBoundingClientRect()
    const scrollerRect = scroller.getBoundingClientRect()
    const targetTop = scrollTopForMarker(scroller.scrollTop, markerRect.top, scrollerRect.top, 16)
    cancelAnimationFrame(scrollFrame.current)
    window.clearTimeout(feedbackTimer.current)
    feedbackAnimation.current?.cancel()
    const startTop = scroller.scrollTop
    const animatedScroll = smooth && !reduceMotion && Math.abs(targetTop - startTop) >= 1
    if (!animatedScroll) {
      scroller.scrollTop = targetTop
    } else {
      const startedAt = performance.now()
      const distance = targetTop - startTop
      const step = (timestamp: number) => {
        const progress = Math.min(1, (timestamp - startedAt) / NEARBY_SCROLL_DURATION_MS)
        scroller.scrollTop = startTop + distance * easeOutQuart(progress)
        if (progress < 1) scrollFrame.current = requestAnimationFrame(step)
        else scrollFrame.current = 0
      }
      scrollFrame.current = requestAnimationFrame(step)
    }
    if (feedback && !reduceMotion) {
      const showFeedback = () => {
        const surface = feedbackSurfaceFor(marker)
        const style = getComputedStyle(surface)
        const highlightColor = getComputedStyle(document.body)
          .getPropertyValue('--dsw-specific-bubble-highlight').trim()
        feedbackAnimation.current = surface.animate(
          arrivalFeedbackKeyframes(style.backgroundColor, highlightColor || style.backgroundColor),
          {
            duration: ARRIVAL_FEEDBACK_DURATION_MS,
            easing: 'linear',
          },
        )
      }
      feedbackTimer.current = window.setTimeout(
        showFeedback,
        animatedScroll ? NEARBY_SCROLL_DURATION_MS : 0,
      )
    }
    setActive(index)
  }, [markers])

  const dragIndex = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!pressed.current) return
    if (!dragging.current && Math.abs(event.clientY - dragStartY.current) < 4) return
    dragging.current = true
    const rect = event.currentTarget.getBoundingClientRect()
    const index = markerIndexAtY(event.clientY, rect.top, rect.height, markers.length)
    if (lastDragged.current === index) return
    lastDragged.current = index
    setHovered(index)
    jumpTo(index, false, false)
  }, [jumpTo, markers.length])

  if (markers.length < MINIMUM_MESSAGES || geometry === null) return null

  const style = {
    '--dsh-user-nav-left': `${geometry.left}px`,
    '--dsh-user-nav-top': `${geometry.top}px`,
    '--dsh-user-nav-height': `${geometry.height}px`,
  } as CSSProperties

  return (
    <nav
      aria-label="用户消息"
      data-user-message-navigation=""
      style={style}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        pressed.current = true
        dragging.current = false
        dragStartY.current = event.clientY
        lastDragged.current = null
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={dragIndex}
      onPointerUp={(event) => {
        if (!pressed.current) return
        suppressClick.current = true
        pressed.current = false
        dragging.current = false
        lastDragged.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={() => {
        suppressClick.current = false
        pressed.current = false
        dragging.current = false
        lastDragged.current = null
      }}
    >
      {markers.map((marker, index) => (
        <button
          key={marker.key}
          type="button"
          style={{ top: `${tickTops[index] ?? 0}px` }}
          aria-label={`跳转到第 ${index + 1} 条用户消息`}
          aria-current={active === index ? 'true' : undefined}
          title={`用户消息 ${index + 1}：${marker.label}`}
          data-active={active === index || undefined}
          data-hovered={hovered === index || undefined}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            suppressClick.current = true
            jumpTo(index, shouldSmoothMarkerDistance(active, index))
          }}
          onPointerEnter={() => { setHovered(index) }}
          onPointerLeave={() => { setHovered(current => current === index ? null : current) }}
          onFocus={() => { setHovered(index) }}
          onBlur={() => { setHovered(current => current === index ? null : current) }}
          onKeyDown={(event) => {
            if (!isMarkerActivationKey(event.key)) return
            event.preventDefault()
            jumpTo(index, shouldSmoothMarkerDistance(active, index))
          }}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false
              return
            }
            jumpTo(index, shouldSmoothMarkerDistance(active, index))
          }}
        >
          <span aria-hidden="true" />
        </button>
      ))}
    </nav>
  )
}

/** Services required by the browser plugin. */
export const inject = ['slots']

/** Register the navigation rail in the frame-wide additive overlay. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-user-message-navigation'
    style.textContent = `
      [data-user-message-navigation] {
        box-sizing: border-box;
        position: fixed;
        z-index: 20;
        left: var(--dsh-user-nav-left);
        top: var(--dsh-user-nav-top);
        width: 36px;
        height: var(--dsh-user-nav-height);
        pointer-events: auto;
        touch-action: none;
      }
      [data-user-message-navigation] button {
        appearance: none;
        border: 0;
        background: transparent;
        position: absolute;
        left: 0;
        right: 0;
        height: 18px;
        display: grid;
        place-items: center;
        padding: 0;
        color: var(--dsw-alias-scrollbar-bg-l1);
        cursor: pointer;
        transition:
          top 200ms cubic-bezier(0.4, 0, 0.2, 1),
          color 120ms ease-out,
          opacity 200ms ease-out,
          transform 200ms ease-out;
      }
      [data-user-message-navigation] button > span {
        display: block;
        width: 11px;
        height: 3px;
        border-radius: 999px;
        background: currentColor;
        transition: transform 120ms ease-out;
      }
      @starting-style {
        [data-user-message-navigation] button {
          opacity: 0;
          transform: scale(0.6);
        }
      }
      [data-user-message-navigation] button[data-active],
      [data-user-message-navigation] button[data-hovered],
      [data-user-message-navigation] button:focus-visible {
        color: var(--dsw-alias-label-secondary);
      }
      [data-user-message-navigation] button[data-hovered] > span,
      [data-user-message-navigation] button:focus-visible > span {
        transform: scaleX(1.45);
      }
      [data-user-message-navigation] button:focus-visible {
        outline: 1px solid currentColor;
        outline-offset: -3px;
        border-radius: 4px;
      }
      @media (prefers-reduced-motion: reduce) {
        [data-user-message-navigation] button,
        [data-user-message-navigation] button > span { transition: none; }
        @starting-style {
          [data-user-message-navigation] button { opacity: 1; transform: none; }
        }
      }
    `
    document.head.appendChild(style)
    const dispose = ctx.slots.inject('shell.overlay', () => ctx.slots.register({
      name: 'shell.overlay',
      id: 'user-message-navigation',
      order: 20,
    }, NavigationRail))
    return () => {
      dispose()
      style.remove()
    }
  }, 'user-message-navigation: overlay registration')
}
