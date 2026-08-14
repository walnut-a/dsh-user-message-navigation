import {
  useCallback, useEffect, useRef, useState,
  type CSSProperties, type PointerEvent as ReactPointerEvent,
} from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import {
  isMarkerActivationKey, markerIndexAtY, previewText, type UserMessageMarker,
} from './runtime.ts'

const MINIMUM_MESSAGES = 4
const RAIL_WIDTH = 36

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

function railGeometry(flow: HTMLElement, scroller: HTMLElement): RailGeometry | null {
  const flowRect = flow.getBoundingClientRect()
  const scrollerRect = scroller.getBoundingClientRect()
  const available = flowRect.left - scrollerRect.left
  if (available < 28 || scrollerRect.height < 160) return null
  const height = Math.min(scrollerRect.height * 0.7, 640)
  return {
    left: Math.round(Math.max(scrollerRect.left, flowRect.left - RAIL_WIDTH - 8)),
    top: Math.round(scrollerRect.top + (scrollerRect.height - height) / 2),
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
  const [active, setActive] = useState(0)
  const [geometry, setGeometry] = useState<RailGeometry | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const pressed = useRef(false)
  const dragging = useRef(false)
  const dragStartY = useRef(0)
  const lastDragged = useRef<number | null>(null)
  const suppressClick = useRef(false)

  const refresh = useCallback(() => {
    const flow = document.querySelector<HTMLElement>('[data-chat-flow]')
    if (flow === null) {
      setMarkers([])
      setGeometry(null)
      return
    }
    const scroller = scrollerFor(flow)
    if (scroller === null) return
    const next = readMarkers(flow)
    setMarkers(next)
    setGeometry(railGeometry(flow, scroller))
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

  const jumpTo = useCallback((index: number, smooth: boolean) => {
    const marker = markers[index]
    if (marker === undefined) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    marker.element.scrollIntoView({
      behavior: smooth && !reduceMotion ? 'smooth' : 'instant',
      block: 'center',
    })
    if (!reduceMotion) {
      marker.element.animate([
        { backgroundColor: 'transparent' },
        { backgroundColor: 'color-mix(in srgb, currentColor 8%, transparent)' },
        { backgroundColor: 'transparent' },
      ], { duration: 700, easing: 'ease-out' })
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
    jumpTo(index, false)
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
        pressed.current = true
        dragging.current = false
        dragStartY.current = event.clientY
        lastDragged.current = null
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={dragIndex}
      onPointerUp={(event) => {
        suppressClick.current = dragging.current
        pressed.current = false
        dragging.current = false
        lastDragged.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={() => {
        pressed.current = false
        dragging.current = false
        lastDragged.current = null
      }}
    >
      {markers.map((marker, index) => (
        <button
          key={marker.key}
          type="button"
          aria-label={`跳转到第 ${index + 1} 条用户消息`}
          aria-current={active === index ? 'true' : undefined}
          title={`用户消息 ${index + 1}：${marker.label}`}
          data-active={active === index || undefined}
          data-hovered={hovered === index || undefined}
          onPointerEnter={() => { setHovered(index) }}
          onPointerLeave={() => { setHovered(current => current === index ? null : current) }}
          onFocus={() => { setHovered(index) }}
          onBlur={() => { setHovered(current => current === index ? null : current) }}
          onKeyDown={(event) => {
            if (!isMarkerActivationKey(event.key)) return
            event.preventDefault()
            jumpTo(index, true)
          }}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false
              return
            }
            jumpTo(index, true)
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
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        align-items: center;
        pointer-events: auto;
        touch-action: none;
      }
      [data-user-message-navigation] button {
        appearance: none;
        border: 0;
        background: transparent;
        width: 36px;
        min-height: 10px;
        flex: 1 1 10px;
        display: grid;
        place-items: center;
        padding: 0;
        color: color-mix(in srgb, currentColor 24%, transparent);
        cursor: pointer;
      }
      [data-user-message-navigation] button > span {
        display: block;
        width: 11px;
        height: 3px;
        border-radius: 999px;
        background: currentColor;
        transition: width 120ms ease, color 120ms ease;
      }
      [data-user-message-navigation] button[data-active],
      [data-user-message-navigation] button[data-hovered],
      [data-user-message-navigation] button:focus-visible {
        color: color-mix(in srgb, currentColor 72%, transparent);
      }
      [data-user-message-navigation] button[data-hovered] > span,
      [data-user-message-navigation] button:focus-visible > span {
        width: 16px;
      }
      [data-user-message-navigation] button:focus-visible {
        outline: 1px solid currentColor;
        outline-offset: -3px;
        border-radius: 4px;
      }
      @media (prefers-reduced-motion: reduce) {
        [data-user-message-navigation] button > span { transition: none; }
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
