# Smart Folder rule matching

Each Smart Folder's local rules have an action and a match mode. **Includes** shows items that match the rule group; **excludes** hides items that match it. **Any** matches when at least one active condition is true; **all** matches only when every active condition is true. Existing Smart Folders default to includes, preserving their original behavior.

For example, to hide anything tagged `asmr` or marked with the privacy effect, choose **excludes / any** and add `Tags contains asmr` and `Blur / Pixelate equals Effect applied`. Conditions using `excludes` or `Effect not applied` are themselves negative tests; combine them with the group action deliberately.

A blank rule group imposes no restriction, including in exclude mode. Each ancestor's local rule group is evaluated separately and combined with descendant groups, so an ancestor exclusion continues to apply to its children. Other saved filters remain independent restrictions.
