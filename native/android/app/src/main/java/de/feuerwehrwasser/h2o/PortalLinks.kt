package de.feuerwehrwasser.h2o

import java.net.URI

/** Only the member portal and appointment entry point can receive native links. */
object PortalLinks {
    const val HOME = "https://ffw-wasser.github.io/home/deckel.html"
    private val paths = setOf("/home/deckel.html", "/home/termin.html")
    fun trusted(value: String): Boolean = runCatching {
        val url = URI(value)
        url.scheme == "https" && url.host == "ffw-wasser.github.io" &&
            url.rawAuthority == "ffw-wasser.github.io" && url.rawPath in paths && url.userInfo == null
    }.getOrDefault(false)

    fun invitation(value: String): Boolean = runCatching {
        val url = URI(value)
        trusted(value) && url.rawPath == "/home/deckel.html" && url.rawQuery == null &&
            Regex("setup=[A-Za-z0-9_-]{16,128}").matches(url.rawFragment ?: "")
    }.getOrDefault(false)
    /** Rebuild only the known calendar day action; never execute intent extras from a URL. */
    fun calendarTime(value: String): Long? = runCatching {
        val url = URI(value)
        if (url.scheme != "intent" || url.rawAuthority != "com.android.calendar" || url.rawQuery != null ||
            !Regex("/time/[0-9]{1,14}").matches(url.rawPath ?: "")) return null
        url.rawPath.substringAfterLast('/').toLong().takeIf { it in 1..32503680000000L }
    }.getOrNull()

}
