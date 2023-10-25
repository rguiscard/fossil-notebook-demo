import { TodoTxt } from "./vendor/todotxt.js"

const app = document.getElementById("app");
var notebookPrefix = null

const extractMetadataFromMarkdown = (markdown) => {
  const charactersBetweenGroupedHyphens = /^---([\s\S]*?)---/;
  const metadataMatched = markdown.match(charactersBetweenGroupedHyphens);

  if (metadataMatched == null) {
    return {meta: null, content: markdown.trim()};
  }

  const metadata = metadataMatched[1];
  const metadataLines = metadata.split("\n");
  const metadataObject = metadataLines.reduce((accumulator, line) => {
    const [key, ...value] = line.split(":").map((part) => part.trim());

    if (key)
      accumulator[key] = value[1] ? value.join(":") : value.join("");
    return accumulator;
  }, {});

  return { meta: metadataObject, content: markdown.substring(metadataMatched[0].length).trim() };
};

// append prefix if needed
function prefixPath(path, func) {
  if (notebookPrefix == null) {
    m.request({
      method: "GET",
      url: "config.th1",
      responseType: "document",
      deserialize: function(value) { return value },
    })
    .then(function(config) {
      notebookPrefix = config.getElementById('notebook-home').textContent.trim()
      func(notebookPrefix+path)
    })
    .catch(function(e) {
      console.log(e)
      // Cannot get config. Use "" as default
      notebookPrefix = ""
      func(path)
    })
  } else {
    func(notebookPrefix+path)
  }
}

// *** User ***

var User = {
  name: null,

  load: function() {
    prefixPath("/json/whoami", function(path) {
      m.request({
        method: "GET",
        url: path,
      })
      .then(function(result) {
        User.name = result.payload.name
      })
    })
  },
   

  display: function() {
    if (User.name == "nobody") {
      return m("a", { href: notebookPrefix+"/login" }, "Login")
    } else {
      return m("a", { href: notebookPrefix+"/login" }, User.name)
    }
  }
}

// *** Files ***

var File = {
  list: [],
  loadDir: function(dir) {
    if (dir == null) {
      dir = "/"
    } else {
      dir = decodeURIComponent(dir) // path from uri may be escaped
    }
    prefixPath("/json/dir", function(path) {
      m.request({
        method: "GET",
        url: path,
        params: {name: dir, checkin: "tip"}
      })
      .then(function(result) {
        var entries = result.payload.entries
        File.list = entries.map(function(entry) {
          // fossil api only read '/' or 'subdir/', not '/subdir' nor '/subdir/'
          var d = result.payload.name + "/" + entry.name
          if (result.payload.name == "/") {
            d = entry.name
          }
          entry.fullPath = d;
          return entry;
        })
      })
    })
  },

  // file 'id' is path
  current: {},
  loadUUID: function(uuid) {
    // Clean previous one first
    File.current = {meta: null, content: null}
    prefixPath("/json/artifact/:uuid", function(path) {
      m.request({
        method: "GET",
        url: path,
        params: {uuid: uuid, format: "raw"}
      })
      .then(function(result) {
        File.current = result.payload
      })
    })
  },
  load: function(filePath) {
    console.log("File.load", filePath)
    // Clean previous one first
    var filePath = decodeURIComponent(filePath) // path from uri may be escaped
    prefixPath("/json/finfo", function(path) {
      m.request({
        method: "GET",
        url: path,
        params: {name: filePath}
      })
      .then(function(result) {
        var payload = result.payload
        console.log(payload)
        if (payload && payload.checkins && (payload.checkins.length > 0)) {
          var uuid = payload.checkins.slice(-1)[0].uuid
          console.log("File.load", result.payload, uuid)
          File.loadUUID(uuid)
        }
      })
    })
  }
}

function FileBreadcrumbs(ivnode) {
  var current_path = "/"

  return {
    view: function(vnode) {
      if (vnode.attrs.path) {
        current_path = decodeURIComponent(vnode.attrs.path)
      }

      var components = current_path.split("/").filter(function(component) {
        return (component.length != 0)
      })
 
      return m("div", 
        m("ul.breadcrumb", [
            m("li.breadcrumb-item",
              m(m.route.Link, {href: m.buildPathname("/files")}, "Home")
            )
          ].concat(components.map(function(component, index, array) {
            var dir = array.slice(0, index+1).join("/")
            return m("li.breadcrumb-item",
              m(m.route.Link, {href: m.buildPathname("/files/:dir", {dir: dir})}, component)
            )
          }))
        )
      )
    }
  }
}

var FileList = {
  oninit: function(vnode) {File.loadDir(vnode.attrs.key)},
  view: function(vnode) {
    var list = File.list.sort(function(a, b) {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
        return 1;
      }
      return 0
    })

    return m("div", [
      m(FileBreadcrumbs, {path: vnode.attrs.key}),
      m("ul", list.map(function(file) {
        var href;
        var params;
        var name;
        if (file.isDir) {
          params = {
            href: "/files/:key...",
            params: {key: file.fullPath}
          }
          name = file.name + "/"
        } else {
          params = {
            href: "/file/:key...",
            params: {key: file.fullPath}
          }
          name = file.name
        }
        return m("li", 
          m(m.route.Link, params, name)
        )
      }))
    ])
  },
};

var FileView = {
  oninit: function(vnode) { File.load(vnode.attrs.key) },
  view: function() {
    var title
    var file_ext
    var content

    if (File.current && File.current.checkins && (File.current.checkins.length > 0)) {
      title = File.current.checkins.slice(-1)[0].name
      file_ext = title.split('.').pop()
    }
    if (File.current.content) {
      if (["js", "css", "html"].includes(file_ext)) {
        return m(PlainTextView, {title: title, content: File.current.content})
      } else {
        // ContentView will render differently based on format field in front matter
        return m(ContentView, {title: title, content: File.current.content})
      }
    } else if (File.current.contentType && (File.current.contentType == "unknown/unknown")) {
      var checkin = File.current.checkins.slice(-1)[0]
      return m(BinaryView, {title: checkin.name, href: m.buildPathname(notebookPrefix+"/file", {name: checkin.name})})
    }
  }
}

// ContentView render solely based on format field
function ContentView(vnode) {
  var content = vnode.attrs.content // full content, including front matter
  var title = vnode.attrs.title

  return {
    oninit: function(vnode) { },
    view: function() {
      if (content) {
        var x = extractMetadataFromMarkdown(content)

        if (x.meta) {
          if (x.meta.title) {
            title = x.meta.title
          }

          if (x.meta.format) {
            var format = x.meta.format
            if (["todotxt", "todo.txt", "todo"].includes(format.toLowerCase())) {
              return m(TodoTxtView, {title: title, meta: x.meta, content: x.content})
            }
          }
        }

        return m(MarkdownView, {title: title, meta: x.meta, content: x.content})
      }
    }
  }
}

function PlainTextView(vnode) {
  var title = vnode.attrs.title
  var content = vnode.attrs.content

  return {
    oninit: function(vnode) { },
    view: function() {
      if (content) {
        var x = extractMetadataFromMarkdown(content)
   
        if (x.meta && x.meta.title) {
          title = x.meta.title
        }
  
        content = m("pre", x.content)
      
        return m("div", {}, [
          m("h3", title),
          x.meta ? m("pre.code", JSON.stringify(x.meta)) : "", 
          m("div", content),
        ])
      }
    }
  }
}

function MarkdownView(vnode) {
  var title = vnode.attrs.title
  var meta = vnode.attrs.meta
  var content = vnode.attrs.content

  return {
    oninit: function(vnode) { },
    view: function() {
      if (content) {
        var markdownContent = m.trust(DOMPurify.sanitize(marked.parse(content)))
      
        return m("div", {}, [
          m("h3", title),
          meta ? m("pre.code", JSON.stringify(meta)) : "", 
          m("div", markdownContent),
        ])
      }
    }
  }
}

function BinaryView(vnode) {
  var title = vnode.attrs.title
  var href = vnode.attrs.href

  return {
    oninit: function(vnode) { },
    view: function() {
      return m("div", {}, [
        m("h3", title),
        m("a", {href: href}, "open")
      ])
    }
  }
}

function TodoTxtView(vnode) {
  var title = vnode.attrs.title
  var meta = vnode.attrs.meta
  var content = vnode.attrs.content

  return {
    oninit: function(vnode) { },
    view: function() {
      if (content) {
        var todos = TodoTxt.parseFile(content).items()
  
        return m("div", {}, [
          m("h3", title),
          meta ? m("pre.code", JSON.stringify(meta)) : "", 
          m("table.table.table-striped.table-hover", [
            m("thead", [
              m("tr", [
                m("th"),
                m("th", "Item"),
                m("th", "Due at"),
              ])
            ]),
            m("tbody", todos.map(function(todo) {
                return m("tr", [
                  m("td.text-right", todo.isComplete() ? '\u2713' : ""),
                  m("td", todo.textTokens().join(" ")),
                  m("td", todo.addons()["due"] || ""),
                ])
              })
            ),
          ])
        ])
      }
    }
  }
}

// *** Wiki ***

var Wiki = {
  list: [], // only names
  loadList: function() {
    prefixPath("/json/wiki/list", function(path) {
      m.request({
        method: "GET",
        url: path,
      })
      .then(function(result) {
        Wiki.list = result.payload.map(function(name) {
          return name
        })
        Wiki.loadData()
      })
    })
  },

  data: {}, // key: uuid; values: names, uuid, content, etc.
  loadData: function() {
    Wiki.list.forEach(function(name) {
      prefixPath("/json/wiki/get", function(path) {
        m.request({
          method: "GET",
          url: path,
          params: {name: name},
        })
        .then(function(result) {
          var x = {meta: null, content: null}
          if (result.payload.content) {
            x = extractMetadataFromMarkdown(result.payload.content)
          }
  
          Wiki.data[result.payload.uuid] = {
            name: name,
            uuid: result.payload.uuid,
            markdown: result.payload.content,
            meta: x.meta,
            content: x.content
          }
        })
      })
    })
  },

  // wiki 'id' is page name
  current: {},
  load: function(id) {
    prefixPath("/json/wiki/get", function(path) {
      m.request({
        method: "GET",
        url: path,
        params: {name: id}
      })
      .then(function(result) {
        Wiki.current = result.payload
      })
    })
  },

  save: function() {
    console.log("save")
    console.log(Wiki.current)
    prefixPath("/json/wiki/save", function(path) {
      m.request({
        method: "POST",
        url: path,
        body: {
          payload: {
            name: Wiki.current.name,
            createIfNotExists: true,
            command: "wiki/save",
            content: Wiki.current.content,
          }
        }
      })
      .then(function(result) {
        console.log(result);
        m.route.set("/wiki/:id", {id: Wiki.current.name})
      })
    })
  },

  delete: function() {
    console.log("delete")
    console.log(Wiki.current)
    prefixPath("/json/wiki/save", function(path) {
      m.request({
        method: "POST",
        url: path,
        body: {
          payload: {
            name: Wiki.current.name,
  //          createIfNotExists: true, // do no delete non-existing note
            command: "wiki/save",
            content: "",
          }
        }
      })
      .then(function(result) {
        console.log(result);
        Wiki.current = {};
        m.route.set("/list");
      })
    })
  },
};

var WikiList = {
  oninit: Wiki.loadList,
  view: function() {
    return m("ul", Wiki.list.map(function(name) {
      return m("li", 
        m(m.route.Link, {
          href: "/wiki/" + name,
        }, name)
      )
    }))
  },
};

var WikiView = {
  oninit: function(vnode) {Wiki.load(vnode.attrs.id)},
  view: function() {
    if (Wiki.current.content) {
      return m("div", {}, [
        m(ContentView, {title: Wiki.current.name, content: Wiki.current.content}),
        m("p"),
        m(m.route.Link, {
          href: "/edit/" + Wiki.current.name,
          class: "btn"
        }, "Edit"),
        m(m.route.Link, {
          href: "#" + Wiki.current.name,
          class: "btn btn-link float-right",
          onclick: function(e) { e.preventDefault(); Wiki.delete() }
        }, "Delete")
      ])
    }
  }
}

var WikiEdit = {
  oninit: function(vnode) {Wiki.load(vnode.attrs.id)},
  view: function() {
    return m("form", {
        onsubmit: function(e) {
          e.preventDefault()
          Wiki.save()
        }
      }, 
      m("div.form-group", [
        m("h4", Wiki.current.name),
        m("label.form-label", "Content"),
        m("textarea.form-input[placeholder=Content][rows='10']", {
          oninput: function(e) {Wiki.current.content = e.target.value},
          value: Wiki.current.content
        }),
        m("button.btn.btn-primary.mt-2.[type=submit]", "Save"),
      ])
    )
  }
}

var WikiNew = {
  view: function() {
    return m("div", [
      m("h3", "New Wiki"),
      m("form", {
        onsubmit: function(e) {
          e.preventDefault()
          Wiki.save()
        }}, 
        m("div.form-group", [
          m("label.form-label", "Title"),
          m("input.form-input[type=text][placeholder=Title]", {
            oninput: function(e) {Wiki.current.name = e.target.value},
          }),
          m("label.form-label", "Content"),
          m("textarea.form-input[placeholder=Content][rows='3']", {
            oninput: function(e) {Wiki.current.content = e.target.value},
          }),
          m("button.btn.btn-primary.mt-2.[type=submit]", "Save"),
        ])
      )
    ])
  }
}


// *** Note (combine files and wiki) ***
const findProject = (str) => {
  regex = /^(([A-Z]\d\d\.)?\d\d(.\d\d)?|([A-Z]\d\d))([\s_]\w*)?$/
  if((arr = regex.exec(str)) != null) {
    return arr[1].length
  }
  return 0
}

var Note = {
  wiki: [],
  loadWiki: function() {
    prefixPath("/json/wiki/list", function(path) {
      m.request({
        method: "GET",
        url: path,
      })
      .then(function(result) {
        result.payload.forEach(function(name) {
          var len = findProject(name)
  //        console.log("Find project", name, len, name.substring(0, len))
        })

        Note.wiki = result.payload.map(function(name) {
          return {name: name}
        })
      })
    })
  },
  data: [],
  loadFileData: function(dir) {
    var exts = ["md", "MD", "txt", "TXT"] // only load data in text format

    // Load all files and wiki
    if (dir == null) {
      dir = "/"
    } else {
      dir = decodeURIComponent(dir) // path from uri may be escaped
    }

    if (dir == "/") {
      Note.data.length = 0
    }

    prefixPath("/json/dir", function(path) {
      m.request({
        method: "GET",
        url: path,
        params: {name: dir, checkin: "tip"}
      })
      .then(function(result) {
        if (result.payload.entries) {
          var entries = result.payload.entries
          // for some reason, entries may be null (Promise not returned ?)
          entries.forEach(function(entry) {
            // fossil api only read '/' or 'subdir/', not '/subdir' nor '/subdir/'
            var filePath = m.buildPathname(":parent/:name", {parent: result.payload.name, name: entry.name})
            if(entry.isDir) {
              if (result.payload.name == "/") {
                filePath = entry.name
              }
              Note.loadFileData(filePath)
            } else {
              var file_ext = entry.name.split('.').pop()
              if (exts.includes(file_ext)) {
                prefixPath("/json/artifact/:uuid", function(path) {
                  m.request({
                    method: "GET",
                    url: path,
                    params: {uuid: entry.uuid, format: "raw"}
                  })
                  .then(function(artifect_result) {
                    if(artifect_result.payload.contentType == "text/plain") {
                      var note = extractMetadataFromMarkdown(artifect_result.payload.content)
                      note.name = entry.name
                      note.href = m.buildPathname("/file/:path", {path: decodeURIComponent(filePath)})
                      Note.data.push(note)
                    }
                  })
                })
              }
            }
          })
        }
      })
    })
  },
  loadWikiData: function() {
    // Load wiki
    prefixPath("/json/wiki/list", function(path) {
      m.request({
        method: "GET",
        url: path,
      })
      .then(function(result) {
        result.payload.forEach(function(name) {
          prefixPath("/json/wiki/get", function(path) {
            m.request({
              method: "GET",
              url: path,
              params: {name: name},
            })
            .then(function(result) {
              var x = {meta: null, content: null}
              if (result.payload.content) {
                x = extractMetadataFromMarkdown(result.payload.content)
              }
              Note.data.push({
                name: name,
                meta: x.meta,
                content: x.content,
                href: "/wiki/"+name
              })
            })
          })
        })
      })
    })
  },
}

function NoteList(vnode) {
  var files = []
  var nid = "0"
  var checked = false
  if (vnode.attrs.nid) {
    nid = vnode.attrs.nid 
  }

  return {
    oninit: function(vnode) { 
      var dir = vnode.attrs.key
      if (dir == null) {
        dir = "/"
      } else {
        dir = decodeURIComponent(dir) // path from uri may be escaped
      }
      prefixPath("/json/dir", function(path) {
        m.request({
          method: "GET",
          url: path,
          params: {name: dir, checkin: "tip"}
        })
        .then(function(result) {
          var entries = result.payload.entries.filter(function(entry) {
            // remove hidden files
            if (entry.name && entry.name[0] == '.') {
              return false
            } else {
              return true
            }
          })

          files = entries.sort(function(a, b) {
            if (a.name < b.name) {
              return -1;
            }
            if (a.name > b.name) {
              return 1;
            }
            return 0
          }).map(function(entry, index) {
            // fossil api only read '/' or 'subdir/', not '/subdir' nor '/subdir/'
            var d = m.buildPathname(":parent/:name", {parent: result.payload.name, name: entry.name})
            if (result.payload.name == "/") {
              d = m.buildPathname(entry.name)
            }
            entry.fullPath = d
            return entry;
          })
        })
      })
    },
    view: function(vnode) {
      if (files.length > 0) {
        return m("div", files.map(function(file, index) {
          var accordionId = "accordion-"+nid+index
          var checkboxAttrs = {type: "checkbox", id: accordionId, name: "accordion-checkbox", hidden: "true"}
          if (checked) {
            checkboxAttrs.checked = "true"
          }
          checkboxAttrs.onclick = function(event) {
            console.log("click ", event.target, event.target.id, event.target.checked)
            // checked = event.target.checked 
            // Not working as to keep status after page changes (oninit called)
          }
          if (file.isDir) {
            return m("div.accordion", [
              m("input", checkboxAttrs),
              m("label.accordion-header", {for: accordionId, style: "padding-top: 0; padding-bottom: 0"}, [
                file.name,
                m("i.icon.icon-arrow-right.ml-1"),
              ]),
              m("div.accordion-body", {style: "padding-left: 1em; margin-bottom: 0"},
                m(NoteList, {key: file.fullPath, nid: nid+index})
              ), 
            ])
          } else {
            return m("div.accordion-header", {style: "padding-top: 0; padding-bottom: 0;"}, [
              m(m.route.Link, 
                { href: "/file/:key...", params: {key: file.fullPath}, target: "_blank", ref: "noopener noreferrer" },
                file.name)
            ])
          }
        }))
      }
    },
  }
}

// *** Todos

function Todos(vnode) {
  var notes = []

  return {
    oninit: function() { Note.loadFileData("/"); Note.loadWikiData(); },
    view: function() {

      // Note with todo field
      var notes = Object.values(Note.data).filter(function(note) {
        if (note.meta && note.meta.todo) {
          return true;
        }
        return false;
      }).map(function(note) {
        return {
          name: note.meta.title || note.name,
          href: note.href,
          status: note.meta.todo,
          due_at: note.meta.due_at,
          completed: ["checked", "done", "finished"].includes(note.meta.todo) ? true : false
        }
      })

      // Note with format: todotxt, todo.txt, todo
      Note.data.filter(function(note) {
        if (note.meta && note.meta.format && ["todotxt", "todo.txt", "todo"].includes(note.meta.format)) {
          return true;
        }
        return false;
      }).map(function(note) {
        var todos = TodoTxt.parseFile(note.content).items()
        todos.forEach(function(todo) {
          notes.push({
            name: todo.textTokens().join(" "),
            href: note.href,
            status: todo.isComplete() ? "checked" : "",
            due_at: todo.addons()["due"] || "",
            completed: todo.isComplete(),
          })
        })
      })

      return m("div", [
        m("h3", "Todos"),
        m("table.table.table-striped.table-hover", [
          m("thead", 
            m("tr", [
              m("th"),
              m("th", "Item"),
              m("th", "Status"),
              m("th", "Due date"),
            ])
          ),
          m("tbody", notes.map(function(note) {
            return m("tr", [
              m("td.text-right", note.completed ? '\u2713' : ""),
              m("td", 
                m(m.route.Link, {
                  href: note.href,
                }, note.name)
              ),
              m("td", note.status),
              m("td", note.due_at),
            ])
          }))
        ])
      ])
    },
  }
};

// *** Bookmark
function Bookmarks(vnode) {
  var current_note = null
  var bookmarks = []

  const walkTokens = (token) => {
    if (token.type === 'link') {
      bookmarks.push({
        text: token.text,
        href: token.href,
        title: token.title,
        note: current_note,
      })
    }
  }

  return {
    oninit: function() {
      console.log("bookmarks init")
      Note.loadFileData("/");
      Note.loadWikiData();
      marked.use({ walkTokens });
    },
    view: function() {
      bookmarks = []
      // Note with bookmark field
      Object.values(Note.data).filter(function(note) {
        if (note.meta && note.meta.bookmark) {
          return true;
        }
        return false;
      }).forEach(function(note) {
        current_note = note
        marked.parse(note.content)
      })
      return m("div", [
        m("h3", "Bookmarks"),
        m("table.table.table-striped.table-hover", [
          m("thead", 
            m("tr", [
              m("th", "Item"),
              m("th", "Note"),
            ])
          ),
          m("tbody", bookmarks.map(function(bookmark) {
            return m("tr", [
              m("td", 
                m("a", {href: bookmark.href},
                  bookmark.title || bookmark.text
                )
              ),
              m("td",
                m(m.route.Link, {
                  href: bookmark.note.href,
                }, bookmark.note.name)
              )
            ])
          }))
        ])
      ])
    },
  }
};

// *** Layout & View ***

var Layout = {
  oninit: User.load,
  view: function(vnode) {
    return m("div", [
      m("header.navbar", [
        m("section.navbar-section", [
          m(m.route.Link, {href: "/list", class: "navbar-brand mr-2"}, "Fossil Notes"),
          m(m.route.Link, {href: "/new", class: "btn btn-link"}, "New"),
          m(m.route.Link, {href: "/files", class: "btn btn-link"}, "Files"),
          m(m.route.Link, {href: "/wiki", class: "btn btn-link"}, "Wiki"),
          m(m.route.Link, {href: "/todos", class: "btn btn-link"}, "Todos"),
          m(m.route.Link, {href: "/bookmarks", class: "btn btn-link"}, "Bookmarks"),
          (User.name == "nobody") ? "" : m("a", { href: "/setup" }, "Admin"),
        ]),
        m("section.navbar-section", [
          m("span", User.display()),
        ]),
      ]),
      m("hr"),
      m("div", vnode.children)
    ])
  }
}

// Mount
//m.mount(app, NoteList)

m.route(app, "/list", {
  "/list": {
    render: function(vnode) {
      return m(Layout, m(NoteList))
    }
  },
  "/list/:key...": {
    render: function(vnode) {
      return m(Layout, m(NoteList, vnode.attrs))
    }
  },
  "/files": {
    render: function() {
      return m(Layout, m(FileList))
    }
  },
  "/files/:key...": {
    render: function(vnode) {
      return m(Layout, m(FileList, vnode.attrs))
    }
  },
  "/file/:key...": {
    render: function(vnode) {
      return m(Layout, m(FileView, vnode.attrs))
    }
  },
  "/wiki": {
    render: function() {
      return m(Layout, m(WikiList))
    }
  },
  "/wiki/:id": {
    render: function(vnode) {
      return m(Layout, m(WikiView, vnode.attrs))
    }
  },
  "/edit/:id": {
    render: function(vnode) {
      return m(Layout, m(WikiEdit, vnode.attrs))
    }
  },
  "/new": {
    render: function(vnode) {
      return m(Layout, m(WikiNew))
    }
  },
  "/todos": {
    render: function() {
      return m(Layout, m(Todos))
    }
  },
  "/bookmarks": {
    render: function() {
      return m(Layout, m(Bookmarks))
    }
  },
})
