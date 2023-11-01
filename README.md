### Fossil Notebook ###

This is a note-keeping web app on top of Fossil SCM. It combines several tools and concepts:

1. [Fossil SCM](https://fossil-scm.org/): version control, synchronization, web server with JSON api.
2. [Johnny Decimal](https://johnnydecimal.com/): file organization method
3. Front Matter: for meta information
4. [Mithril.js](https://mithril.js.org/): Javascript framework for front end

#### Download ####

Download it from [github](https://github.com/rguiscard/fossil-notebook-demo/releases/tag/demo)

#### Installation ####

[Install fossil](https://fossil-scm.org/home/doc/trunk/www/build.wiki). 

JSON API support is necessary. Some binary packages have JSON API built-in. To check, start the fossil server with this demo repository or any other fossil repositories, and connect to \<fossil server ip\>:8080/json/stat with browser, you should see some information, or [compile with --enable-json](https://fossil-scm.org/home/doc/trunk/www/json-api/intro.md#builing).

It is also better to compile with `--with-th1-docs` just in case, especially for multiple repositories support (see below).

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

#### Multiple Repositories ####

Fossil SCM supports [serving multiple repositories](https://fossil-scm.org/home/help?cmd=server) through the same ip address with `--repolist`. For example, if there are _work.fossil_ and _budget.fossil_ under directory _/home/user/repositories_, start `fossil server --repolist /home/user/repositories` allows browser connecting to \<fossil server ip\>:8080/work to `work.fossil`, and \<fossil server ip\>:8080/budget to `budget.fossil`. It makes divide notes into different repositories easier. But to make web app work in this way, **th1** support is necessary. So remember to compile Fossil with `--wit-th1-docs`.

### Future Plan ###

This way of keeping notes is very opinioned. Different people will have different kinds of document and notes to keep, and want to have different kind of web app, for example, image viewer for collection of photos, or PDF viewer for office document. Therefore, the main web app will be kept small and minimal for the purpose of demo. Peopoe will probably fork this repository for their needed.

#### Extension / Plug-in ####

If you want to add more web app, a work is in progress that any html file ended with `.app.html` will be open straight instead of displayed as text file. In such case, you can have your own web app opened easier from the main web app. But again, this web app is quite opinioned. You probably should consider to fork it.
