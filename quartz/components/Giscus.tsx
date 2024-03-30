import { QuartzComponentConstructor } from "./types"

export default (() => {
  function Footer() {
    return (
     <script 
        src="https://giscus.app/client.js"
        data-repo="abhiaagarwal/notes"
        data-repo-id="R_kgDOLnXmLA"
        data-category="Comments"
        data-category-id="DIC_kwDOLnXmLM4CeVd3"
        data-mapping="pathname"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="top"
        data-lang="en"
        data-loading="lazy"
        crossorigin="anonymous"
        async>
    </script>
    )
  }

  return Footer
}) satisfies QuartzComponentConstructor