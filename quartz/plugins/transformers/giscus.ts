import { PluggableList } from "unified"
import { visit } from "unist-util-visit"
import { QuartzTransformerPlugin } from "../types"

export interface Options {
  repo: string
  repoId: string
  category: string
  categoryId: string
  mapping: string
  strict: boolean
  reactionsEnabled: boolean
  emitMetadata: boolean
  inputPosition: string
  them: string
  lang: string
}

export const Giscus: QuartzTransformerPlugin<Partial<Options> | undefined> = (userOpts) => {
  const opts = { ...userOpts }
  return {
    name: "Giscus",
    htmlPlugins() {
      const plugins: PluggableList = []

      // Add rehype-citation to the list of plugins
      plugins.push([
        rehypeCitation,
        {
          bibliography: opts.bibliographyFile,
          suppressBibliography: opts.suppressBibliography,
          linkCitations: opts.linkCitations,
        },
      ])

      // Transform the HTML of the citattions; add data-no-popover property to the citation links
      // using https://github.com/syntax-tree/unist-util-visit as they're just anochor links
      plugins.push(() => {
        return (tree, _file) => {
          visit(tree, "element", (node, index, parent) => {
            if (node.tagName === "a" && node.properties?.href?.startsWith("#bib")) {
              node.properties["data-no-popover"] = true
            }
          })
        }
      })

      return plugins
    },
  }
}
