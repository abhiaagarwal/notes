import { i18n } from "../../i18n"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

const NotFound: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
  return (
    <article class="popover-hint">
      <h1>404</h1>
      <p>"You've stumbled on something you shouldn't have. Prepared to die."</p>
    </article>
  )
}

export default (() => NotFound) satisfies QuartzComponentConstructor
