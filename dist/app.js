"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mysql = require('mysql2');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter1 = createCsvWriter({
    path: 'Отчет1.csv',
    header: [
        { id: 'fio', title: 'ФИО' },
        { id: 'countBefore', title: 'Кол-во кандидатов до распределения' },
        { id: 'countToTest', title: 'Кол-во кандидатов, которых довел до тестового задания' },
        { id: 'countAfter', title: 'Кол-во кандидатов после распределения' },
    ]
});
const csvWriter2 = createCsvWriter({
    path: 'Отчет2.csv',
    header: [
        { id: 'fio', title: 'ФИО' },
        { id: 'countBefore', title: 'Кол-во кандидатов до распределения' },
        { id: 'countAfter', title: 'Кол-во кандидатов после распределения' },
        { id: 'countToCheck', title: 'Кол-во кандидатов, которых нужно проверить' }
    ]
});
const dbConfig = {
    host: '81.31.247.100',
    port: 3306,
    user: 'NWrTUY',
    password: 'CnfLZmJoncBaklxE',
    database: 'testdatabase'
};
const connection = mysql.createConnection(dbConfig);
connection.connect((error) => {
    if (error) {
        console.log(error);
    }
    console.log('sucessful connection!');
    let cur_recruters_ids = '';
    connection.execute("SELECT * FROM `employees` WHERE role='рекрутер' ORDER BY `efficiency` DESC", function (error, results) {
        if (error) {
            console.log(error);
        }
        const allRekruters = results;
        let recruters_id = [];
        for (let recruter in allRekruters) {
            let rec_id = allRekruters[recruter].id;
            recruters_id.push(rec_id);
        }
        let recruters_id_str = recruters_id.join(", ");
        cur_recruters_ids = '(' + recruters_id_str + ')';
        connection.execute("SELECT * FROM `candidates` WHERE date_test = 0", (error, result) => {
            if (error) {
                console.log(error);
            }
            let all_candidate = result;
            connection.execute(`SELECT * FROM candidate_to_employee_assign WHERE employee_id in ${cur_recruters_ids}`, (err, res) => {
                let candidatesWithRecruter = res;
                let candToPush = [];
                let newCandForRecrut = new Map;
                for (let i = 0; i < all_candidate.length; i++) {
                    let id = all_candidate[i].id;
                    let city = all_candidate[i].city_id;
                    let flag = false;
                    for (let candidate in candidatesWithRecruter) {
                        if (candidatesWithRecruter[candidate].candidate_id == id && candidatesWithRecruter[candidate].city_id == city) {
                            flag = true;
                            break;
                        }
                    }
                    if (!flag) {
                        if (newCandForRecrut.has(allRekruters[i % allRekruters.length].id)) {
                            let prevVal = newCandForRecrut.get(allRekruters[i % allRekruters.length].id);
                            newCandForRecrut.set(allRekruters[i % allRekruters.length].id, prevVal + 1);
                        }
                        else {
                            newCandForRecrut.set(allRekruters[i % allRekruters.length].id, 1);
                        }
                        let cur_cand = [all_candidate[i].id, all_candidate[i].city_id, allRekruters[i % allRekruters.length].id, new Date().toISOString().slice(0, 19).replace('T', ' ')];
                        candToPush.push(cur_cand);
                    }
                }
                connection.query("INSERT INTO `candidate_to_employee_assign` (`candidate_id`, `city_id`, `employee_id`, `created_at`) VALUES ?", [candToPush], (error) => {
                    if (error) {
                        console.log(error);
                    }
                });
                connection.execute("SELECT * FROM `candidates` WHERE date_test >= 1717354800", (error, res) => {
                    if (error) {
                        console.log(error);
                    }
                    let candidatesWithTest = res;
                    let candidateToEmployees = [];
                    let counterRecToTest = 0;
                    for (let candidate_wt in candidatesWithTest) {
                        let employeeID = 0;
                        for (let candidate_wr in candidatesWithRecruter) {
                            if (candidatesWithRecruter[candidate_wr].candidate_id === candidatesWithTest[candidate_wt].id && candidatesWithRecruter[candidate_wr].city_id === candidatesWithTest[candidate_wt].city_id) {
                                counterRecToTest++;
                                employeeID = candidatesWithRecruter[candidate_wr].employee_id;
                                connection.query(`DELETE FROM candidate_to_employee_assign WHERE candidate_id=${candidatesWithRecruter[candidate_wr].candidate_id} AND city_id=${candidatesWithRecruter[candidate_wr].city_id}`, (err) => {
                                    if (err) {
                                        console.log(err);
                                    }
                                });
                            }
                        }
                        candidateToEmployees.push({
                            candidate_id: candidatesWithTest[candidate_wt].id,
                            city_id: candidatesWithTest[candidate_wt].city_id,
                            employee_id: employeeID,
                            created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                        });
                    }
                    console.log("Сколько Кандидатов сделали тестовое задание и при этом были закреплены за рекрутерами до сбоя в CRM? " + counterRecToTest);
                    let rekurtsStatToTest = new Map;
                    for (let candidate in candidateToEmployees) {
                        if (candidateToEmployees[candidate].employee_id === 0) {
                            continue;
                        }
                        if (rekurtsStatToTest.has(candidateToEmployees[candidate].employee_id)) {
                            let prev_val = rekurtsStatToTest.get(candidateToEmployees[candidate].employee_id);
                            rekurtsStatToTest.set(candidateToEmployees[candidate].employee_id, prev_val + 1);
                        }
                        else {
                            rekurtsStatToTest.set(candidateToEmployees[candidate].employee_id, 1);
                        }
                    }
                    let otchetRekruters = [];
                    for (let recruter in allRekruters) {
                        let countBefore = allRekruters[recruter].attached_candidates_count;
                        let countAfter = newCandForRecrut.get(allRekruters[recruter].id);
                        let countToTest = 0;
                        if (!(rekurtsStatToTest.get(allRekruters[recruter].id) === undefined)) {
                            countToTest = rekurtsStatToTest.get(allRekruters[recruter].id);
                        }
                        let cur_data = {
                            fio: allRekruters[recruter].fio,
                            countBefore: countBefore,
                            countAfter: countAfter,
                            countToTest: countToTest
                        };
                        otchetRekruters.push(cur_data);
                    }
                    csvWriter1.writeRecords(otchetRekruters);
                    connection.execute("SELECT * FROM `employees` WHERE role='разработчик' ORDER BY `efficiency` DESC", (err, res) => {
                        if (err) {
                            console.log(err);
                        }
                        let allRazrabs = res;
                        let newCandidatesToRazrabs = new Map;
                        for (let candidate in candidateToEmployees) {
                            for (let razrab in allRazrabs) {
                                if (newCandidatesToRazrabs.has(allRazrabs[razrab].id) && (newCandidatesToRazrabs.get(allRazrabs[razrab].id) + allRazrabs[razrab].attached_candidates_count) < 3000) {
                                    let prev_val = newCandidatesToRazrabs.get(allRazrabs[razrab].id);
                                    newCandidatesToRazrabs.set(allRazrabs[razrab].id, prev_val + 1);
                                    connection.query(`INSERT INTO candidate_to_employee_assign (candidate_id, city_id, employee_id, created_at) VALUES (${candidateToEmployees[candidate].candidate_id}, ${candidateToEmployees[candidate].city_id}, ${allRazrabs[razrab].id}, new Date().toISOString().slice(0, 19).replace('T', ' '))`, (error) => {
                                        if (error) {
                                            console.log(error);
                                        }
                                    });
                                    break;
                                }
                                else if (allRazrabs[razrab].attached_candidates_count < 3000 && !newCandidatesToRazrabs.has(allRazrabs[razrab].id)) {
                                    newCandidatesToRazrabs.set(allRazrabs[razrab].id, 1);
                                    break;
                                }
                            }
                        }
                        let otchetRazrabs = [];
                        let maxCountToCheck = 0;
                        let nameRazrabWithMax = '';
                        for (let razrab in allRazrabs) {
                            let countBefore = allRazrabs[razrab].attached_candidates_count;
                            let countAfter = 0;
                            if (newCandidatesToRazrabs.has(allRazrabs[razrab].id)) {
                                countAfter = countBefore + newCandidatesToRazrabs.get(allRazrabs[razrab].id);
                            }
                            else {
                                countAfter = countBefore;
                            }
                            let countToCheck = countAfter - countBefore;
                            if (countToCheck > maxCountToCheck) {
                                maxCountToCheck = countToCheck;
                                nameRazrabWithMax = allRazrabs[razrab].fio;
                            }
                            let curData = {
                                fio: allRazrabs[razrab].fio,
                                countBefore: countBefore,
                                countAfter: countAfter,
                                countToCheck: countToCheck
                            };
                            otchetRazrabs.push(curData);
                        }
                        console.log('Какому «Разработчику» после вашего распределения больше всего досталось новых Кандидатов и их тестовых заданий? И сколько ему досталось? ' + nameRazrabWithMax + ' ' + maxCountToCheck);
                        csvWriter2.writeRecords(otchetRazrabs);
                        connection.end();
                    });
                });
            });
        });
    });
});
