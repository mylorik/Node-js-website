/*********************************************************************************
* WEB322 – Assignment 06
* I declare that this assignment is my own work in accordance with Seneca Academic Policy. No part
* of this assignment has been copied manually or electronically from any other source
* (including 3rd party web sites) or distributed to other students.
*
* Name: Artem Kulihina Student ID: 128516168 Date: 06.12.2018
*
* Online (Heroku) Link: https://limitless-basin-96853.herokuapp.com/
*
********************************************************************************/

const express = require("express");
const path = require("path");
const dataSrv = require("./data-service.js")
const HTTP_PORT = process.env.PORT || 8080;
const app = express();
const multer = require("multer");
const fs = require("fs");
const bodyParser = require("body-parser");
const exphbs = require("express-handlebars");
const dataServiceAuth = require("./data-service-auth.js");
const clientSessions = require("client-sessions");

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(clientSessions({
    cookieName: "session",
    secret: "ADJQU289ADKQIMLS0248FHANZCVHJT62412EWLQXXCFSWERLL342KMB45QMZLYJD",
    duration: 2 * 60 * 1000,
    activeDuration: 1000 * 60
}));

app.use(function (req, res, next) {
    res.locals.session = req.session;
    next();
});

function ensureLogin(req, res, next) {
    if (!req.session.user) {
        res.redirect("/login");
    } else {
        next();
    }
}

function onHttpStart() {
    console.log(`Express http server listening on: ${HTTP_PORT}`);
}

app.engine('.hbs', exphbs({
    extname: '.hbs',
    defaultLayout: 'main',
    helpers: {
        navLink: function (url, options) {
            return '<li' +
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
                '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        }
    }
}));

app.use(function (req, res, next) {
    let route = req.baseUrl + req.path;
    app.locals.activeRoute = (route == "/") ? "/" : route.replace(/\/$/, "");
    next();
});

app.set('view engine', '.hbs');

const storage = multer.diskStorage({
    destination: "./public/images/uploaded",
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


app.get("/", (req, res) => { res.render("home"); });

app.get("/home", function (req, res) { res.render("home"); });

app.get("/about", (req, res) => { res.render("about"); });

app.get("/departments/add", ensureLogin, (req, res) => { res.render("addDepartment"); });

app.get("/images/add", ensureLogin, (req, res) => { res.render("addImage"); });

app.post("/images/add", ensureLogin, upload.single(("imageFile")), (req, res) => { res.redirect("/images"); });

app.get("/employees/add", ensureLogin, function (req, res) {
    dataSrv.getDepartments().then((data) => {
        res.render("addEmployee", {
            departments: data
        });
    }).catch(() => {
        res.render("addEmployee", {
            departments: []
        });
    });
});

app.get("/employees", ensureLogin, function (req, res) {
    if (req.query.status) {
        dataSrv.getEmployeesByStatus(req.query.status).then((data) => {
            if (data.length > 0) {
                res.render("employees", {
                    employees: data
                });
            } else {
                res.render("employees", {
                    message: "no results"
                });
            }
        }).catch(() => {
            res.status(500).send("Unable to get employees by status");
        })
    } else if (req.query.department) {
        if (parseInt(req.query.department)) {
            dataSrv.getEmployeesByDepartment(req.query.department).then((data) => {
                if (data.length > 0) {
                    res.render("employees", {
                        employees: data
                    });
                } else {
                    res.render("employees", {
                        message: "no results"
                    });
                }
            }).catch(() => {
                res.status(500).send("Unable to get employees by department");
            })
        } else {
            var dept;
            dataSrv.getDepartments().then((data) => {
                for (let i = 0; i < data.length; i++) {
                    if (data[i].departmentName == req.query.department) {
                        dept = data[i];
                        dataSrv.getEmployeesByDepartment(dept.departmentId).then((data) => {
                            if (data.length > 0) {
                                res.render("employees", {
                                    employees: data
                                });
                            } else {
                                res.render("employees", {
                                    message: "no results"
                                });
                            }
                        }).catch(() => {
                            res.status(500).send("Unable to get employees by department");
                        });
                        break;
                    }
                }
            }).catch(() => {
                res.status(500).send("Unable to get employees by department");
            })
        }
    } else if (req.query.manager) {
        dataSrv.getEmployeesByManager(req.query.manager).then((data) => {
            if (data.length > 0) {
                res.render("employees", {
                    employees: data
                });
            } else {
                res.render("employees", {
                    message: "no results"
                });
            }
        }).catch(() => {
            res.status(500).send("Unable to get employees by manager");
        })
    } else {
        dataSrv.getAllEmployees().then((data) => {
            if (data.length > 0) {
                res.render("employees", {
                    employees: data
                });
            } else {
                res.render("employees", {
                    message: "no results"
                });
            }
        }).catch(() => {
            res.status(500).send("Unable to get all employees");
        })
    }
});

app.get("/departments", ensureLogin, function (req, res) {
    dataSrv.getDepartments().then((data) => {
        if (data.length > 0) {
            res.render("departments", {
                departments: data
            });
        } else {
            res.render("departments", {
                message: "data.length <= 0 "
            });
        }
    }).catch(function (err) {
        res.render({ message: err });
    });
});

app.get("/images", ensureLogin, (req, res) => {
    fs.readdir("./public/images/uploaded", function (err, data) {
        res.render('images', {
            images: data
        });
    });
});

app.get("/employee/:empNum", ensureLogin, (req, res) => {
    // initialize an empty object to store the values
    let viewData = {};
    dataSrv.getEmployeeByNum(req.params.empNum).then((data) => {
        if (data) {
            viewData.employee = data; //store employee data in the "viewData" object as "employee"
        } else {
            viewData.employee = null; // set employee to null if none were returned
        }
    }).catch(() => {
        viewData.employee = null; // set employee to null if there was an error
    }).then(dataSrv.getDepartments)
        .then((data) => {
            viewData.departments = data; // store department data in the "viewData" object as "departments"
            // loop through viewData.departments and once we have found the departmentId that matches
            // the employee's "department" value, add a "selected" property to the matching
            // viewData.departments object
            for (let i = 0; i < viewData.departments.length; i++) {
                if (viewData.departments[i].departmentId == viewData.employee.department) {
                    viewData.departments[i].selected = true;
                }
            }
        }).catch(() => {
            viewData.departments = []; // set departments to empty if there was an error
        }).then(() => {
            if (viewData.employee == null) { // if no employee - return an error
                res.status(404).send("Employee Not Found");
            } else {
                res.render("employee", {
                    viewData: viewData
                }); // render the "employee" view
            }
        });
});

app.get('/employees/delete/:empNum', ensureLogin, (req, res) => {
    dataSrv.deleteEmployeeByNum(req.params.empNum)
        .then(() => {
            res.redirect("/employees");
        }).catch(() => {
            res.status(500).send("Unable to Remove Employee / Employee not found");
        });
});

app.get('/department/:departmentId', ensureLogin, (req, res) => {

    dataSrv.getDepartmentById(req.params.departmentId)
        .then((data) => {
            if (data) {
                res.render("department", {
                    department: data
                });
            } else {
                res.status(404).send("Department Not Found");
            }
        })
        .catch(() => {
            res.status(404).send("Department Not Found");
        })
});

app.get('/departments/delete/:departmentId', ensureLogin, (req, res) => {

    dataSrv.deleteDepartmentById(req.params.departmentId)
        .then(() => {
            res.redirect("/departments");
        }).catch(() => {
            res.status(500).send("Unable to Remove Department / Department not found");
        });
});

app.get("/login", (req, res) => {
    res.render("login");
})

app.get("/register", (req, res) => {
    res.render("register");
})

app.get("/logout", (req, res) => {
    req.session.reset();
    res.redirect("/");
})

app.get("/userHistory", ensureLogin, (req, res) => {
    res.render("userHistory");
})

app.post("/register", (req, res) => {
    dataServiceAuth.registerUser(req.body)
        .then((data) => {
            res.render("register", { successMessage: "User created" });
        }).catch((err) => {
            res.render("register", { errorMessage: err, userName: req.body.userName });
        })
})

app.post("/login", (req, res) => {
    req.body.userAgent = req.get("User-Agent");

    dataServiceAuth.checkUser(req.body)
        .then((data) => {
            req.session.user = {
                userName: data.userName,
                email: data.email,
                loginHistory: data.loginHistory
            }
            res.redirect("/employees");

        }).catch((err) => {
            res.render("login", { errorMessage: err, userName: req.body.userName });
        })
})

app.post("/departments", ensureLogin, (req, res) => {
    dataSrv.getDepartments().then((data) => {
        res.render("employees", {
            employees: data
        });
    }).catch(() => {
        res.status(500).send("No Departments");
    })
});

app.post("/departments/add", ensureLogin, (req, res) => {
    dataSrv.addDepartment(req.body).then(() => {
        res.redirect("/departments");
    }).catch(() => {
        res.status(500).send("Unable to add department");
    });
});

app.post("/department/update", ensureLogin, (req, res) => {
    dataSrv.updateDepartment(req.body).then(() => {
        res.redirect("/departments");
    }).catch(() => {
        res.status(500).send("Unable to Update Department");
    });
});

app.post("/employees/add", ensureLogin, (req, res) => {
    dataSrv.addEmployee(req.body).then(() => {
        res.redirect("/employees")
    }).catch(() => {
        res.status(500).send("Unable to add employee");
    });
});

app.post("/employee/update", ensureLogin, (req, res) => {
    dataSrv.updateEmployee(req.body).then(() => {
        res.redirect("/employees");
    }).catch(() => {
        res.status(500).send("Unable to Update Employee");
    });
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, "/views/404.html"));
});

dataSrv.initialize()
    .then(dataServiceAuth.initialize)
    .then(function () {
        app.listen(HTTP_PORT, function () {
            console.log("app listening on: " + HTTP_PORT)
        });
    }).catch(function (err) {
        console.log("unable to start server: " + err);
    });


