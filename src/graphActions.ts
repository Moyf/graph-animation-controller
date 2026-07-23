import type { GraphEngineController } from "./graphEngine"
import { assertNever, type GraphKeyboardAction } from "./keyboardShortcuts"
import type { GraphControls } from "./uiControls"
import type { GraphAnimationControllerApi, GraphDataEngine } from "./types"

export type GraphAction = GraphKeyboardAction

export type GraphActionContext = {
  readonly engine: GraphDataEngine
  readonly refresh: () => void
  readonly toggleBigProgressBar: () => void
}

export type GraphActionExecutor = {
  readonly run: (context: GraphActionContext, action: GraphAction) => void
}

type GraphActionDependencies = {
  readonly api: GraphAnimationControllerApi
  readonly engineController: GraphEngineController
}

export type GraphActionButtonBindings = {
  readonly controls: GraphControls
  readonly run: (action: GraphAction) => void
}

export function bindGraphActionButtons({ controls, run }: GraphActionButtonBindings): void {
  controls.replayButtonEl.onClickEvent(() => {
    run("replay")
    releaseFocus(controls.replayButtonEl)
  })
  controls.backButtonEl.onClickEvent(() => {
    run("seekBackward")
    releaseFocus(controls.backButtonEl)
  })
  controls.playButtonEl.onClickEvent(() => {
    run("playPause")
    releaseFocus(controls.playButtonEl)
  })
  controls.forwardButtonEl.onClickEvent(() => {
    run("seekForward")
    releaseFocus(controls.forwardButtonEl)
  })
}

export function createGraphActionExecutor(
  api: GraphAnimationControllerApi,
  engineController: GraphEngineController,
): GraphActionExecutor {
  const dependencies = { api, engineController } satisfies GraphActionDependencies
  return {
    run: (context, action) => {
      switch (action) {
        case "playPause":
          togglePlay(context, dependencies)
          return
        case "replay":
          engineController.replay(context.engine)
          context.refresh()
          return
        case "seekBackward":
          seek(context, dependencies, -1)
          return
        case "seekForward":
          seek(context, dependencies, 1)
          return
        case "toggleBigProgressBar":
          context.toggleBigProgressBar()
          return
        default:
          assertNever(action)
      }
    },
  }
}

function togglePlay(context: GraphActionContext, dependencies: GraphActionDependencies): void {
  if (context.engine._graphAnimationControllerPaused !== true && context.engine.progression > 0) {
    dependencies.engineController.pause(context.engine)
  } else {
    dependencies.engineController.play(context.engine)
  }
  context.refresh()
}

function seek(context: GraphActionContext, dependencies: GraphActionDependencies, direction: -1 | 1): void {
  dependencies.engineController.seek(context.engine, direction, dependencies.api.getSettings().seekStepPercent)
  context.refresh()
}

function releaseFocus(element: HTMLElement): void {
  window.setTimeout(() => element.blur(), 0)
}
