import { createNewSortInstance } from 'fast-sort'

const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

export = naturalSort
