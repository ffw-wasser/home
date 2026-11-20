package de.feuerwehrwasser.h2o

import java.net.URI

/** Only the member portal and appointment entry point can receive native links. */
object PortalLinks {
    const val HOME = "https://ffw-wasser.github.io/home/deckel.html"
    const val RADIO_VIDEO = "https://www.instagram.com/reel/Df9f91IyBTQ/"

    fun opensRadioVideo(source: String, destination: String, userInitiated: Boolean): Boolean =
        userInitiated && trusted(source) && URI(source).rawPath == "/home/deckel.html" && destination == RADIO_VIDEO

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
    fun calendarTimestamp(value: String): Long? = value.takeIf { Regex("[0-9]{1,14}").matches(it) }
        ?.toLongOrNull()?.takeIf { it in 1..32503680000000L }

    /** Rebuild only the known calendar day action; never execute intent extras from a URL. */
    fun calendarTime(value: String): Long? = runCatching {
        val url = URI(value)
        if (url.scheme != "intent" || url.rawAuthority != "com.android.calendar" || url.rawQuery != null ||
            !Regex("/time/[0-9]{1,14}").matches(url.rawPath ?: "")) return null
        calendarTimestamp(url.rawPath.substringAfterLast('/'))
    }.getOrNull()

}
