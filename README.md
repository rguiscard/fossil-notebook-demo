### Fossil Notebook ###

This is a note-keeping web app on top of Fossil SCM. It combines several tools and concepts:

1. [Fossil SCM](https://fossil-scm.org/): version control, synchronization, web server with JSON api.
2. [Johnny Decimal](https://johnnydecimal.com/): file organization method
3. Front Matter: for meta information
4. [Mithril.js](https://mithril.js.org/): Javascript framework for front end

#### Download ####

Download it from [github](https://github.com/rguiscard/fossil-notebook-demo/releases/tag/demo)

#### Installation ####

[Install fossil](https://fossil-scm.org/home/doc/trunk/www/build.wiki), better to have tcl support just in case.

#### Run ####

`fossil server notebook-demo.fossil` and use browser to connect to \<fossil server ip\>:8080

#### Login ####

use demo:demo as user:password. Not necessary for reading.

#### Write notes ####

Use `fossil open` to create a local copy of repository. Add notes in markdown format inside local repository. Use `fossil addremove` if new files are added. `fossil commit` to commit. 

Read notes at `00-09.System/02.Documentation/` for more details.

### How does it work ###

Fossil supports [project documentation](https://www.fossil-scm.org/home/doc/trunk/www/embeddeddoc.wiki). It basically serves as a web server for static files. A web app can be created as project documentation and served by fossil. Fossil also support [JSON api](https://www.fossil-scm.org/home/doc/trunk/www/json-api/index.md) to read files inside repository. Therefore, this web app can access content in the fossil repository. The drawback is that web app cannot create files inside repository. But fossil also support wiki which is readable and wriable through its JSON api.

In some sense, this can be seen as a highly [customized skin](https://www.fossil-scm.org/home/doc/trunk/www/customskin.md) of Fossil SCM.
